import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MIN_TEXT = 200;
const MAX_TEXT = 120000;
const MAX_PRINCIPLES = 8;

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    principles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          principle: { type: 'string' },
          paragraph_ref: { type: 'string' },
        },
        required: ['principle', 'paragraph_ref'],
      },
    },
  },
  required: ['summary', 'principles'],
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const caseLawId = typeof body.case_law_id === 'string' ? body.case_law_id : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!caseLawId) return Response.json({ error: 'case_law_id is required' }, { status: 400 });
    if (text.length < MIN_TEXT) {
      return Response.json(
        { error: 'The judgment text is too short to record principles from.' },
        { status: 400 }
      );
    }

    const record = await base44.entities.CaseLaw.get(caseLawId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!record) return Response.json({ error: 'Authority not found' }, { status: 404 });

    const prompt = `You are JurisAI, reading a UK judgment to record the legal principles a solicitor will rely on.

## Authority on file
Name: ${record.name}
Neutral citation: ${record.neutral_citation || 'not recorded'}

## Judgment text
"""
${text.slice(0, MAX_TEXT)}
"""

## Task
1. Write a summary of the decision in no more than 80 words.
2. Record up to ${MAX_PRINCIPLES} legal principles established or applied in this judgment.

## Rules - absolute
- Every principle must come from the judgment text above. Do not add anything from memory.
- For each principle give the paragraph reference exactly as it appears in the judgment (for example "para 45" or "[45]").
- Quote no more than a short phrase. Do not paraphrase into a different proposition.
- If the text does not contain a clear ratio, say so in the summary and record fewer principles rather than inventing any.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
    });

    const parsed = typeof result === 'string' ? { summary: '', principles: [] } : result;
    const incoming = (Array.isArray(parsed.principles) ? parsed.principles : [])
      .filter((item) => item && typeof item.principle === 'string' && item.principle.trim())
      .slice(0, MAX_PRINCIPLES);

    const existingRefs = Array.isArray(record.principle_refs) ? record.principle_refs : [];
    const seen = new Set(existingRefs.map((ref) => (ref.principle || '').toLowerCase().trim()));

    const fresh = [];
    for (const item of incoming) {
      const key = item.principle.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push({
        principle: item.principle.trim(),
        paragraph_ref: typeof item.paragraph_ref === 'string' ? item.paragraph_ref.trim() : '',
      });
    }

    const principleRefs = [...existingRefs, ...fresh];
    const existingPrinciples = Array.isArray(record.principles) ? record.principles : [];
    const principles = Array.from(
      new Set([...existingPrinciples, ...principleRefs.map((ref) => ref.principle)].filter(Boolean))
    );

    await base44.entities.CaseLaw.update(caseLawId, {
      principle_refs: principleRefs,
      principles,
      summary: record.summary || (typeof parsed.summary === 'string' ? parsed.summary.trim() : ''),
    });

    return Response.json({
      summary: record.summary || parsed.summary || '',
      added: fresh,
      principle_refs: principleRefs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}