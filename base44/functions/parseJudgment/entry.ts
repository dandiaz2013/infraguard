import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { extractCandidates, courtFor, yearFor, MAX_CANDIDATES } from '../../shared/citationParser.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const judgmentId = typeof body.judgment_id === 'string' ? body.judgment_id : '';
    if (!judgmentId) return Response.json({ error: 'judgment_id is required' }, { status: 400 });

    const judgment = await base44.entities.Judgment.get(judgmentId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!judgment) return Response.json({ error: 'Judgment not found' }, { status: 404 });

    const rawText = typeof judgment.raw_text === 'string' ? judgment.raw_text : '';
    if (!rawText.trim()) {
      return Response.json(
        { error: 'This judgment has no text yet. Paste the judgment text before parsing.' },
        { status: 400 }
      );
    }

    // Preview: hand the candidates back for review, save nothing.
    if (!Array.isArray(body.candidates)) {
      const candidates = extractCandidates(rawText);
      return Response.json({ candidates, found: candidates.length });
    }

    // Confirm: create or match authorities, then record the citations.
    let found = 0;
    let matched = 0;
    let created = 0;
    let skipped = 0;
    let linked = 0;

    try {
      const existingCaseLaw = await base44.asServiceRole.entities.CaseLaw.filter({});
      const byCitation = new Map();
      const byName = new Map();
      existingCaseLaw.forEach((record) => {
        if (record.neutral_citation) byCitation.set(record.neutral_citation.toLowerCase().trim(), record);
        if (record.name) byName.set(record.name.toLowerCase().trim(), record);
      });

      const existingCitations = await base44.asServiceRole.entities.JudgmentCitation.filter({
        judgment_id: judgmentId,
      });

      const rows = body.candidates.slice(0, MAX_CANDIDATES);
      found = rows.length;

      for (const row of rows) {
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        const citation = typeof row.neutral_citation === 'string' ? row.neutral_citation.trim() : '';
        if (!name && !citation) {
          skipped += 1;
          continue;
        }

        const displayName = name || `Unknown - ${citation}`;
        // A case can be extracted twice, once by neutral citation and once by law
        // report. Both belong to one record, which then carries both citations.
        const isReport = row.link_status === 'Law report citation, no automatic link';
        const neutralCitation = isReport ? '' : citation;
        const reportCitation = isReport ? citation : '';
        try {
          if (isReport && !name) {
            skipped += 1;
            continue;
          }

          let record = neutralCitation ? byCitation.get(neutralCitation.toLowerCase()) : null;
          if (!record && reportCitation) record = byCitation.get(reportCitation.toLowerCase()) || null;
          if (!record) record = byName.get(displayName.toLowerCase()) || null;

          if (record) {
            matched += 1;
            if (reportCitation && record.report_reference !== reportCitation) {
              await base44.entities.CaseLaw.update(record.id, { report_reference: reportCitation });
              record.report_reference = reportCitation;
              byCitation.set(reportCitation.toLowerCase(), record);
            }
            if (neutralCitation && !record.neutral_citation) {
              await base44.entities.CaseLaw.update(record.id, { neutral_citation: neutralCitation });
              record.neutral_citation = neutralCitation;
              byCitation.set(neutralCitation.toLowerCase(), record);
            }
          } else {
            record = await base44.entities.CaseLaw.create({
              name: displayName,
              neutral_citation: neutralCitation,
              report_reference: reportCitation,
              court: row.court || courtFor(citation),
              year: row.year || yearFor(citation) || undefined,
              url: judgment.source_url || '',
              source_note: `Parsed from judgment: ${judgment.title}`,
              verified: false,
            });
            created += 1;
            if (neutralCitation) byCitation.set(neutralCitation.toLowerCase(), record);
            if (reportCitation) byCitation.set(reportCitation.toLowerCase(), record);
            byName.set(displayName.toLowerCase(), record);
          }

          const paragraphRef = row.paragraph_ref || '';
          const duplicate = existingCitations.some(
            (item) => item.case_law_id === record.id && (item.paragraph_ref || '') === paragraphRef
          );
          if (duplicate) {
            skipped += 1;
            continue;
          }

          const citationRecord = await base44.entities.JudgmentCitation.create({
            judgment_id: judgmentId,
            case_law_id: record.id,
            context_type: 'other',
            paragraph_ref: paragraphRef,
            excerpt: row.excerpt || '',
            note: '',
          });
          existingCitations.push(citationRecord);
          linked += 1;
        } catch (rowError) {
          skipped += 1;
        }
      }
    } catch (error) {
      await base44.entities.Judgment.update(judgmentId, {
        parse_status: 'failed',
        parse_log: `Parse failed: ${error.message}`,
      });
      return Response.json({ error: error.message }, { status: 500 });
    }

    const log = `Found ${found} candidate${found === 1 ? '' : 's'}: ${matched} matched existing authorit${matched === 1 ? 'y' : 'ies'}, ${created} created, ${skipped} skipped, ${linked} citation${linked === 1 ? '' : 's'} saved.`;

    await base44.entities.Judgment.update(judgmentId, {
      parse_status: 'parsed',
      parse_log: log,
    });

    return Response.json({ status: 'parsed', found, matched, created, skipped, linked, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}