import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { uniqueCitations } from '../../shared/citationParser.ts';
import { caseFileDocuments } from '../../shared/caseFile.ts';

const DISCLAIMER =
  'Draft for review. Check every authority against the official judgment before filing. Not legal advice.';

const POSITIONS = ['Claimant', 'Defendant', 'Appellant', 'Respondent'];

const SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'string' },
    our_argument: { type: 'string' },
    response: { type: 'string' },
    authorities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          case_name: { type: 'string' },
          citation: { type: 'string' },
          link: { type: 'string' },
          paragraph: { type: 'string' },
          principle: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['case_name', 'citation', 'paragraph', 'principle', 'status'],
      },
    },
    gaps: { type: 'string' },
  },
  required: ['issues', 'our_argument', 'response', 'authorities', 'gaps'],
};

function authorityBlock(record) {
  const refs = Array.isArray(record.principle_refs) ? record.principle_refs : [];
  const detail = refs.length
    ? refs
        .map((ref) => `${ref.paragraph_ref || 'paragraph not recorded'} - ${ref.principle}`)
        .join(' | ')
    : Array.isArray(record.principles) && record.principles.length
      ? record.principles.join(' | ')
      : 'No principle recorded in the library';

  return [
    `- Case name: ${record.name}`,
    `  Neutral citation: ${record.neutral_citation || 'none stored'}`,
    `  Link: ${record.url || 'none stored'}`,
    `  Paragraph reference and principle: ${detail}`,
    `  Status: ${record.verified === true ? 'VERIFIED' : 'UNVERIFIED'}`,
  ].join('\n');
}

// No document limit and no per-document character limit: the whole case file is sent.
function buildCorpus(files) {
  return files
    .map(
      (file) =>
        `### File: ${file.file_name}\nCategory: ${file.category || 'Document'}\n"""\n${file.text}\n"""`
    )
    .join('\n\n');
}

function buildMarkdown(matter, position, result) {
  const rows = (Array.isArray(result.authorities) ? result.authorities : []).map((row) => {
    const cells = [row.case_name, row.citation, row.link, row.paragraph, row.principle, row.status].map(
      (value) =>
        String(value || '')
          .replace(/\|/g, '/')
          .replace(/\n+/g, ' ')
          .trim()
    );
    return `| ${cells.join(' | ')} |`;
  });

  return [
    `# Argument - ${matter.matter_name || 'Matter'}`,
    '',
    `**Court:** ${matter.court || 'Not specified'}`,
    '',
    `**Position:** ${position}`,
    '',
    '## Issues in dispute',
    result.issues || '',
    '',
    '## Our argument',
    result.our_argument || '',
    '',
    "## Response to the other party's case",
    result.response || '',
    '',
    '## Authorities relied on',
    '| Case | Citation | Link | Paragraph | Principle | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(rows.length ? rows : ['| No authority from the library was relied on | | | | | |']),
    '',
    '## Gaps and risks',
    result.gaps || '',
    '',
    `> ${DISCLAIMER}`,
  ].join('\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matterId = typeof body.matter_id === 'string' ? body.matter_id : '';
    const position = POSITIONS.includes(body.position) ? body.position : 'Claimant';
    const includeUnverified = body.include_unverified === true;
    if (!matterId) return Response.json({ error: 'matter_id is required' }, { status: 400 });

    const matter = await base44.entities.Matter.get(matterId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!matter) return Response.json({ error: 'Matter not found' }, { status: 404 });

    const files = await caseFileDocuments(base44, matterId);
    const readable = files.filter((file) => typeof file.text === 'string' && file.text.trim());
    if (readable.length === 0) {
      return Response.json({ error: 'Upload the matter documents first.' }, { status: 400 });
    }

    const usages = await base44.entities.CaseLawUsage.filter({ matter_id: matterId });
    const linkedIds = [...new Set(usages.map((usage) => usage.case_law_id).filter(Boolean))];
    const linked = linkedIds.length
      ? await base44.entities.CaseLaw.filter({ id: { $in: linkedIds } })
      : [];

    const verified = linked.filter((record) => record.verified === true);
    const unverified = linked.filter((record) => record.verified !== true);
    const pool = includeUnverified ? [...verified, ...unverified] : verified;

    const authorityList = pool.length
      ? pool.map(authorityBlock).join('\n\n')
      : 'NONE - the library holds no authority for this matter yet, so every point of law must be flagged.';

    const step2Issues = matter.simple_arguments && Array.isArray(matter.simple_arguments.issues)
      ? matter.simple_arguments.issues
          .map((item) => `- ${item.issue || ''}${item.plain_english ? `: ${item.plain_english}` : ''}`)
          .join('\n')
      : '';

    const prompt = `You are JurisAI, drafting a UK legal argument for a solicitor. Work ONLY from the matter documents and the authority list below.

## Matter
Name: ${matter.matter_name || 'Untitled'}
Type: ${matter.matter_type || 'N/A'}
Court: ${matter.court || 'Not specified'}
Our client: ${matter.client_name || 'Not recorded'}
We act for the: ${position}
${step2Issues ? `\n## Issues already identified from the documents\n${step2Issues}\n` : ''}
## Authorities available - the ONLY authorities you may cite
${authorityList}

## Matter documents
${buildCorpus(readable)}

## Rules - these are absolute
1. Cite an authority only by the case name and neutral citation exactly as stored above, with the stored paragraph reference and principle. Never add a citation, paragraph number or quotation that is not in the authority list or in the documents above.
2. A VERIFIED authority may be cited normally. An UNVERIFIED authority must be followed by the exact marker [UNVERIFIED - CHECK BEFORE USE].
3. If the argument needs a point of law the authority list does not cover, write [AUTHORITY NEEDED: describe the proposition] in place of a citation. Never invent or recall an authority.
4. Do not reproduce long passages of the documents. Give the file name and paragraph number, and quote no more than a short phrase.
5. Where the argument meets a paragraph of the other party's witness statement, answers a factual misstatement, or is contradicted by a document, name that document and paragraph number.
6. Do not invent facts, dates, names or procedural history.

## Output
Return JSON with:
- issues: the issues in dispute, each with a short heading.
- our_argument: our full argument, with headings and numbered points.
- response: our response to the other party's case, point by point.
- authorities: one entry per authority actually cited - case_name, citation, link, paragraph, principle, status (VERIFIED or UNVERIFIED), exactly as stored above.
- gaps: gaps and risks, including every [AUTHORITY NEEDED] item and any evidential weakness.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
    });

    const parsed = typeof result === 'string'
      ? { issues: '', our_argument: '', response: '', authorities: [], gaps: '' }
      : result;

    const markdown = buildMarkdown(matter, position, parsed);

    // Deterministic check: every citation in the draft must exist in the library.
    const library = await base44.entities.CaseLaw.filter({});
    const libraryByCitation = new Map();
    library.forEach((record) => {
      if (record.neutral_citation) libraryByCitation.set(record.neutral_citation.toLowerCase().trim(), record);
    });

    const checks = uniqueCitations(markdown).map((citation) => {
      const record = libraryByCitation.get(citation.toLowerCase().trim());
      const refs = record && Array.isArray(record.principle_refs) ? record.principle_refs : [];
      const paragraphs = [...new Set(refs.map((ref) => ref.paragraph_ref).filter(Boolean))].join(', ');
      return {
        citation,
        matched: Boolean(record),
        library_id: record ? record.id : '',
        library_name: record ? record.name : '',
        paragraph: paragraphs,
        verified: record ? record.verified === true : false,
        problem: record ? '' : 'No matching authority in the Case Law Library',
      };
    });

    for (const row of Array.isArray(parsed.authorities) ? parsed.authorities : []) {
      const citation = typeof row.citation === 'string' ? row.citation.trim() : '';
      const record = citation ? libraryByCitation.get(citation.toLowerCase()) : null;
      const name = typeof row.case_name === 'string' ? row.case_name.trim() : '';
      if (!record || !name || !record.name) continue;
      if (name.toLowerCase() !== record.name.toLowerCase()) {
        checks.push({
          citation,
          matched: false,
          library_id: record.id,
          library_name: record.name,
          paragraph: '',
          verified: record.verified === true,
          problem: `Authority table names this case "${name}" but the library record is "${record.name}"`,
        });
      }
    }

    return Response.json({
      draft_markdown: markdown,
      sections: {
        issues: parsed.issues || '',
        our_argument: parsed.our_argument || '',
        response: parsed.response || '',
        authorities: Array.isArray(parsed.authorities) ? parsed.authorities : [],
        gaps: parsed.gaps || '',
      },
      checks,
      mismatch_count: checks.filter((check) => !check.matched).length,
      position,
      included_unverified: includeUnverified,
      authorities_included: pool.map((record) => ({
        id: record.id,
        name: record.name,
        citation: record.neutral_citation || '',
        verified: record.verified === true,
      })),
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}