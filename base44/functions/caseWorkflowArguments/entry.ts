import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MAX_DOCUMENTS = 20;
const MAX_DOC_CHARS = 14000;
const MAX_TOTAL_CHARS = 60000;

const CATEGORY_ORDER = [
  'Case summary and pleadings',
  'Our witness statement',
  'Other party witness statement',
  'N244 and continuation sheet',
  'Previous judgments and orders',
  'Other document',
];

const SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          plain_english: { type: 'string' },
        },
        required: ['issue', 'plain_english'],
      },
    },
    our_arguments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          argument: { type: 'string' },
          basis_document: { type: 'string' },
          basis_paragraph: { type: 'string' },
        },
        required: ['argument', 'basis_document', 'basis_paragraph'],
      },
    },
    their_arguments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          argument: { type: 'string' },
          basis_document: { type: 'string' },
          basis_paragraph: { type: 'string' },
        },
        required: ['argument', 'basis_document', 'basis_paragraph'],
      },
    },
  },
  required: ['issues', 'our_arguments', 'their_arguments'],
};

function orderFiles(files) {
  return files.slice().sort((a, b) => {
    const left = CATEGORY_ORDER.indexOf(a.category);
    const right = CATEGORY_ORDER.indexOf(b.category);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
  });
}

function buildCorpus(files) {
  let total = 0;
  const blocks = [];

  for (const file of files) {
    if (total >= MAX_TOTAL_CHARS) break;
    const room = Math.min(MAX_DOC_CHARS, MAX_TOTAL_CHARS - total);
    const text = file.text.slice(0, room);
    total += text.length;
    blocks.push(
      `### File: ${file.file_name}\nCategory: ${file.category || 'Document'}\n"""\n${text}\n"""`
    );
  }

  return { corpus: blocks.join('\n\n'), documentsUsed: blocks.length };
}

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
    const readable = orderFiles(
      files.filter((file) => typeof file.text === 'string' && file.text.trim())
    ).slice(0, MAX_DOCUMENTS);

    if (readable.length === 0) {
      return Response.json(
        { error: 'Upload the case documents first — the analysis reads only those documents.' },
        { status: 400 }
      );
    }

    const { corpus, documentsUsed } = buildCorpus(readable);

    const prompt = `You are JurisAI, reading a UK litigation bundle for a solicitor. You must work ONLY from the documents supplied below.

## Matter
Name: ${matter.matter_name || 'Untitled'}
Type: ${matter.matter_type || 'N/A'}
Court: ${matter.court || 'Not recorded'}
Our client: ${matter.client_name || 'Not recorded'}

## Documents
${corpus}

## Task
1. List the main issues in dispute, in plain English a lay client would understand. Give each a short heading and one or two sentences.
2. Write between 3 and 6 simple arguments for OUR side (the party acting for our client named above), in plain English.
3. Write between 3 and 6 simple arguments for THE OTHER PARTY, in plain English.
4. For every argument state the document it rests on (use the exact file name) and the paragraph number as it appears in that document. If the document has no paragraph numbers, write "no paragraph numbers".

## Rules - these are absolute
- Use only the documents above. Do not use outside knowledge, and do not research.
- Do NOT name any case law, statute or other authority unless it appears in the documents themselves. If one does appear, copy its citation exactly as written.
- Do not invent facts, dates, names or procedural history. If the documents are silent on something material, say so plainly.
- No advice and no predictions of outcome. Describe the argument, not the chances.
- Keep every argument to one or two sentences of plain English.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
    });

    const parsed = typeof result === 'string' ? { issues: [], our_arguments: [], their_arguments: [] } : result;

    return Response.json({
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      our_arguments: Array.isArray(parsed.our_arguments) ? parsed.our_arguments : [],
      their_arguments: Array.isArray(parsed.their_arguments) ? parsed.their_arguments : [],
      documents_used: documentsUsed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}