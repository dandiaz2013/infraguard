import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// One section of the skeleton argument at a time. The record paragraphs are sent in
// full (no character limit and no document limit), so a paragraph beyond the start of
// a long document still reaches the model with its exact wording.

const USER_MARKER = '[USER STATEMENT - NO DOCUMENT REFERENCE]';

const RULES = `RULES - follow every one:
1. Use only the record paragraphs and stored extracts supplied. Never invent a fact, a date, a quotation, a paragraph number or an authority.
2. Every factual statement must end with a reference in the form {{DOC:<document id>|para 46}} or {{DOC:<document id>|p.16 lines 9-12}}, using the document id printed beside that paragraph. No reference, no statement.
3. Every legal proposition must quote the stored extract word for word, with the case name and the paragraph number exactly as stored. Where a principle is needed and no stored extract covers it, write [NO EXTRACT: <case name>, <proposition>].
4. Where a fact is needed and is not in the record paragraphs, write [FACT NEEDED: what is needed]. Do not fill the gap yourself.
5. Wording supplied as a statement by the user must be used exactly as given and must keep its marker ${USER_MARKER}. Never present it as something in the documents.
6. Give the other side's answer as it appears in the record, then our reply to it.
7. Numbered paragraphs (1., 2., 3. ...). No headings, no commentary, no summary of these rules.
8. End with a conclusion paragraph that states what follows for this issue.`;

function text(value: unknown, limit = 200000) {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

function paragraphBlock(paragraphs: Record<string, string>[]) {
  if (!paragraphs.length) return 'NONE SUPPLIED.';
  return paragraphs
    .map(
      (paragraph, index) =>
        `### RECORD PARAGRAPH ${index + 1}\nDocument: ${paragraph.document_name || 'not recorded'}\nReference: ${
          paragraph.ref || 'not recorded'
        }\nDocument id: ${paragraph.document_id || 'not recorded'}\nEXACT TEXT:\n${paragraph.text || ''}`
    )
    .join('\n\n');
}

function extractBlock(extracts: Record<string, string>[]) {
  if (!extracts.length) return 'NONE SUPPLIED.';
  return extracts
    .map(
      (extract) =>
        `- ${extract.case_name || 'unnamed authority'} ${extract.citation || ''}, paragraph ${
          extract.paragraph_ref || 'not recorded'
        } (${extract.checked ? 'checked against the official text' : 'NOT CHECKED'})\n  EXACT TEXT: ${
          extract.extract_text || ''
        }\n  Proposition: ${extract.proposition || 'not stated'}`
    )
    .join('\n');
}

function userBlock(statements: Record<string, string>[]) {
  if (!statements.length) return 'NONE SUPPLIED.';
  return statements
    .map((statement) => `- ${statement.text}${statement.source_document ? ` (user says this is in ${statement.source_document})` : ''}`)
    .join('\n');
}

function otherSideBlock(answers: Record<string, string>[]) {
  if (!answers.length) return 'Nothing in the record answers this for the other side.';
  return answers
    .map((answer) => `- “${answer.quote || ''}” (${answer.document_name || ''}, ${answer.ref || ''})`)
    .join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = typeof body.mode === 'string' ? body.mode : 'section';
    const court = text(body.court, 120);
    const position = text(body.position, 120);
    const matterName = text(body.matterName, 240);
    const paragraphs = Array.isArray(body.record_paragraphs) ? body.record_paragraphs.slice(0, 60) : [];
    const extracts = Array.isArray(body.extracts) ? body.extracts.slice(0, 80) : [];
    const statements = Array.isArray(body.user_statements) ? body.user_statements.slice(0, 60) : [];
    const otherSide = Array.isArray(body.other_side) ? body.other_side.slice(0, 10) : [];

    if (mode === 'review') {
      const draft = text(body.draft, 80000);
      if (!draft.trim()) return Response.json({ error: 'draft is required' }, { status: 400 });

      const prompt = `You are reviewing an assembled skeleton argument for ${position} in ${court} before it is filed.

## The draft
${draft}

## The record paragraphs the draft may rely on
${paragraphBlock(paragraphs)}

## The stored extracts the draft may quote
${extractBlock(extracts)}

Identify up to 8 of the weakest passages. For each, quote the passage exactly as it appears, say what is wrong (a statement with no reference, an unsupported principle, a conflict with the record, or an overstatement), and give one concrete fix. Quote only wording that actually appears in the draft. Never invent a passage.

The {{DOC:<document id>|para N}} markers and the open markers such as [FACT NEEDED: ...], [NO EXTRACT: ...] and ${USER_MARKER} are deliberate parts of this draft. Never flag them as formatting errors, and never suggest removing them: they are how every statement is tied to the record.`;
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            passages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  passage: { type: 'string' },
                  problem: { type: 'string' },
                  fix: { type: 'string' },
                  kind: { type: 'string' },
                },
                required: ['passage', 'problem', 'fix'],
              },
            },
          },
          required: ['passages'],
        },
      });

      return Response.json({ passages: Array.isArray(result?.passages) ? result.passages : [] });
    }

    const section = body.section || {};
    const title = text(section.title, 240);
    const kind = text(section.kind, 40) || 'issue';
    const ask = text(section.ask, 600);
    const approach = text(body.approach, 1200);
    const explanation = text(body.explanation, 4000);
    const note = text(body.note, 1200);
    const issueTitles = Array.isArray(body.issue_titles) ? body.issue_titles.slice(0, 10) : [];

    const narrative = kind === 'narrative';
    const instruction = narrative
      ? `Write the section "${title}" of the skeleton argument. 250-500 words. ${
          section.key === 'relief'
            ? 'State the primary relief and the alternative relief, each tied to the record or the application notice.'
            : section.key === 'responses'
              ? 'Set out the responses the other side is likely to advance, each answered from the record.'
              : 'Open the document and give a one-page summary of the application, the order challenged, the gateway relied on and the relief sought.'
        }`
      : `Write ONE section of the skeleton argument for this gateway issue. 300-700 words.
Issue: ${ask}
Approach chosen by the lawyer: ${approach || 'not yet chosen - work from the record paragraphs'}
The lawyer's explanation to the court: ${explanation || 'none supplied'}`;

    const prompt = `You are JurisAI, drafting a UK skeleton argument for ${position} in ${court}.
Matter: ${matterName || 'unnumbered matter'}

## THIS SECTION
${instruction}

${note ? `## CORRECTION REQUIRED IN THIS SECTION\n${note}\n` : ''}
## RECORD PARAGRAPHS - full text, the only facts you may use
${paragraphBlock(paragraphs)}

## THE OTHER SIDE'S ANSWER FROM THE RECORD
${otherSideBlock(otherSide)}

## STORED EXTRACTS - the only authority wording you may quote
${extractBlock(extracts)}

## STATEMENTS BY THE USER - no document reference, keep the marker
${userBlock(statements)}

${issueTitles.length ? `## THE ISSUES IN THIS ARGUMENT, IN ORDER\n${issueTitles.map((entry, index) => `${index + 1}. ${entry}`).join('\n')}\n` : ''}
${RULES}

Write only the section text.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const content = typeof result === 'string' ? result : JSON.stringify(result);
    return Response.json({ content: content.trim() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});