import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  buildEvidenceCorpus,
  buildOurPoints,
  buildClauses,
  buildMisstatements,
  buildExtracts,
} from '../../shared/argumentContext.ts';
import { caseFileDocuments } from '../../shared/caseFile.ts';

const ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    strongest: {
      type: 'array',
      items: {
        type: 'object',
        properties: { point: { type: 'string' }, source: { type: 'string' } },
        required: ['point', 'source'],
      },
    },
    weakest: {
      type: 'array',
      items: {
        type: 'object',
        properties: { point: { type: 'string' }, source: { type: 'string' } },
        required: ['point', 'source'],
      },
    },
    counter_arguments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          their_argument: { type: 'string' },
          our_answer: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['their_argument', 'our_answer', 'source'],
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { risk: { type: 'string' }, source: { type: 'string' } },
        required: ['risk', 'source'],
      },
    },
    legal_test: { type: 'string' },
    open_questions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['strongest', 'weakest', 'counter_arguments', 'risks', 'legal_test', 'open_questions'],
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matterId = typeof body.matter_id === 'string' ? body.matter_id.trim() : '';
    const argumentText = typeof body.argument_text === 'string' ? body.argument_text.trim() : '';
    if (!matterId) return Response.json({ error: 'matter_id is required' }, { status: 400 });
    if (!argumentText) return Response.json({ error: 'argument_text is required' }, { status: 400 });

    const matter = await base44.entities.Matter.get(matterId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!matter) return Response.json({ error: 'Matter not found' }, { status: 404 });

    const files = await caseFileDocuments(base44, matterId, { sort: '-created_date', limit: 20 });
    const { corpus, count } = buildEvidenceCorpus(files);

    const extractPage = await base44.entities.AuthorityExtract.list({ sort: '-added_date', limit: 60 });
    const extracts = extractPage.items || [];
    const caseLawPage = await base44.entities.CaseLaw.list({ sort: '-created_date', limit: 60 });
    const caseLaw = caseLawPage.items || [];

    const checklist = Array.isArray(body.checklist) ? body.checklist.slice(0, 12) : [];
    const checklistBlock = checklist
      .map((item) => `- [${item.result}] (${item.priority}) ${item.label} - ${item.reason || ''}`)
      .join('\n');

    const position = typeof body.position === 'string' ? body.position : 'the client';
    const ourPoints = Array.isArray(body.our_points) ? body.our_points.slice(0, 40) : [];
    const clauses = Array.isArray(body.contract_clauses) ? body.contract_clauses.slice(0, 30) : [];
    const misstatements = Array.isArray(body.misstatements) ? body.misstatements.slice(0, 30) : [];

    const prompt = `You are JurisAI, assessing how well an argument is evidenced and supported for ${position}.

Matter: ${matter.matter_name || 'unnamed'} | Court: ${matter.court || 'not set'} | Type: ${matter.matter_type || 'not set'}

## THE ARGUMENT AS DRAFTED
"""
${argumentText.slice(0, 18000)}
"""

## CHECKLIST ALREADY CALCULATED IN CODE (do not recalculate or restate the rating)
${checklistBlock || 'No checklist supplied.'}

## DOCUMENTS UPLOADED TO THIS MATTER (${count})
${corpus || 'NONE UPLOADED'}${buildExtracts(extracts, caseLaw)}${buildOurPoints(ourPoints)}${buildClauses(clauses)}${buildMisstatements(misstatements)}

## HARD RULES
- You are not predicting the court's decision. Never give a percentage, a probability, odds, or say anyone will win or lose.
- Every statement must point to a source written as [Document: <document name>, <paragraph>] or [Extract: <case name>, <paragraph>].
- If you cannot support a statement from the material above, put it in open_questions instead of stating it as a conclusion.
- State the legal test ONLY if a stored extract above contains it, citing that extract. Otherwise legal_test must be exactly: [LEGAL TEST NEEDED: ask user to add the authority extract]
- No advice about tactics that is not tied to the material.

## RETURN
- strongest: the strongest points and why, each with its source.
- weakest: the weakest points and why, each with its source.
- counter_arguments: exactly three, the best arguments the other side will make, each with our best answer drawn from our documents and a source.
- risks: for example the court seeing this as relitigating a decided point, each tied to a document or a stored extract.
- legal_test: as directed above.
- open_questions: anything the assessment could not support.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: ASSESSMENT_SCHEMA,
    });

    return Response.json({
      assessment: result || {},
      documents_used: count,
      extracts_used: extracts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}