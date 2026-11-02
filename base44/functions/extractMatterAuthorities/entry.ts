import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { extractCandidates, buildCaseLink, courtFor, yearFor } from '../../shared/citationParser.ts';

const MAX_DOCUMENTS = 40;
const MAX_LISTED = 200;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matterId = typeof body.matter_id === 'string' ? body.matter_id : '';
    if (!matterId) return Response.json({ error: 'matter_id is required' }, { status: 400 });

    const matter = await base44.entities.Matter.get(matterId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!matter) return Response.json({ error: 'Matter not found' }, { status: 404 });

    const files = await base44.entities.MatterFile.filter({ matter_id: matterId });
    const readable = files
      .filter((file) => typeof file.text === 'string' && file.text.trim())
      .slice(0, MAX_DOCUMENTS);

    if (readable.length === 0) {
      return Response.json(
        { error: 'Upload at least one document with readable text before building the library.' },
        { status: 400 }
      );
    }

    // One entry per authority across the whole bundle, keeping its first appearance.
    const found = new Map();
    for (const file of readable) {
      for (const candidate of extractCandidates(file.text)) {
        const citation = typeof candidate.neutral_citation === 'string' ? candidate.neutral_citation.trim() : '';
        const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
        if (!name && !citation) continue;
        const key = citation ? `c:${citation.toLowerCase()}` : `n:${name.toLowerCase()}`;
        if (found.has(key)) continue;
        found.set(key, {
          name: name || `Unknown - ${citation}`,
          citation,
          court: candidate.court || (citation ? courtFor(citation) : ''),
          year: candidate.year || (citation ? yearFor(citation) : null),
          paragraph_ref: candidate.paragraph_ref || '',
          document: file.file_name || 'Document',
        });
      }
    }

    if (found.size === 0) {
      return Response.json({
        found: 0,
        documents_scanned: readable.length,
        already_held: 0,
        newly_added: 0,
        linked: 0,
        already_linked: 0,
        added: [],
        held: [],
        no_link: [],
      });
    }

    const library = await base44.entities.CaseLaw.filter({});
    const byCitation = new Map();
    const byName = new Map();
    library.forEach((record) => {
      if (record.neutral_citation) byCitation.set(record.neutral_citation.toLowerCase().trim(), record);
      if (record.name) byName.set(record.name.toLowerCase().trim(), record);
    });

    const usages = await base44.entities.CaseLawUsage.filter({ matter_id: matterId });
    const usedIds = new Set(usages.map((usage) => usage.case_law_id));

    let alreadyHeld = 0;
    let newlyAdded = 0;
    let linked = 0;
    let alreadyLinked = 0;
    const added = [];
    const held = [];
    const noLink = [];

    for (const entry of found.values()) {
      let record = entry.citation ? byCitation.get(entry.citation.toLowerCase()) : null;
      if (!record) record = byName.get(entry.name.toLowerCase()) || null;

      const autoLink = buildCaseLink(entry.citation);

      if (record) {
        alreadyHeld += 1;
        if (held.length < MAX_LISTED) {
          held.push({
            id: record.id,
            name: record.name,
            citation: record.neutral_citation || entry.citation,
            verified: record.verified === true,
            link: record.url || '',
            document: entry.document,
          });
        }
      } else {
        record = await base44.entities.CaseLaw.create({
          name: entry.name,
          neutral_citation: entry.citation,
          court: entry.court || '',
          year: entry.year || undefined,
          url: autoLink,
          summary: '',
          principles: [],
          verified: false,
          source_note: `Extracted from ${entry.document} (matter: ${matter.matter_name || 'untitled'})`,
        });
        newlyAdded += 1;
        if (entry.citation) byCitation.set(entry.citation.toLowerCase(), record);
        byName.set(entry.name.toLowerCase(), record);
        if (added.length < MAX_LISTED) {
          added.push({
            id: record.id,
            name: record.name,
            citation: entry.citation,
            link: autoLink,
            document: entry.document,
          });
        }
      }

      if (!record.url && !autoLink && noLink.length < MAX_LISTED) {
        noLink.push({ id: record.id, name: entry.name, citation: entry.citation, document: entry.document });
      }

      if (usedIds.has(record.id)) {
        alreadyLinked += 1;
        continue;
      }

      await base44.entities.CaseLawUsage.create({
        matter_id: matterId,
        case_law_id: record.id,
        context_type: 'other',
        stance: 'neutral',
        note: `Found in ${entry.document}${entry.paragraph_ref ? ` (${entry.paragraph_ref})` : ''}`,
      });
      usedIds.add(record.id);
      linked += 1;
    }

    return Response.json({
      found: found.size,
      documents_scanned: readable.length,
      already_held: alreadyHeld,
      newly_added: newlyAdded,
      linked,
      already_linked: alreadyLinked,
      added,
      held,
      no_link: noLink,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}