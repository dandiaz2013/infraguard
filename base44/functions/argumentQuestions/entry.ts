import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  buildEvidenceCorpus,
  buildOurPoints,
  buildClauses,
  buildMisstatements,
  buildAnswers,
  buildExtracts,
} from '../../shared/argumentContext.ts';

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          why: { type: 'string' },
          affects: { type: 'string' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
        },
        required: ['question', 'why', 'affects', 'priority'],
      },
    },
  },
  required: ['questions'],
};

const CONFLICT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          conflict: { type: 'boolean' },
          conflict_detail: { type: 'string' },
          confirm_question: { type: 'string' },
        },
        required: ['index', 'conflict', 'conflict_detail', 'confirm_question'],
      },
    },
  },
  required: ['results'],
};

function normalisePriority(value) {
  const text = String(value || '').toLowerCase();
  if (text.startsWith('high')) return 'High';
  if (text.startsWith('low')) return 'Low';
  return 'Medium';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = typeof body.mode === 'string' ? body.mode : 'questions';
    const matterId = typeof body.matter_id === 'string' ? body.matter_id.trim() : '';
    if (!matterId) return Response.json({ error: 'matter_id is required' }, { status: 400 });

    const matter = await base44.entities.Matter.get(matterId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!matter) return Response.json({ error: 'Matter not found' }, { status: 404 });

    const filePage = await base44.entities.MatterFile.filter({ matter_id: matterId }, { sort: '-created_date', limit: 20 });
    const files = filePage.items || [];
    const { corpus, count } = buildEvidenceCorpus(files);

    const extractPage = await base44.entities.AuthorityExtract.list({ sort: '-added_date', limit: 60 });
    const extracts = extractPage.items || [];
    const caseLawPage = await base44.entities.CaseLaw.list({ sort: '-created_date', limit: 60 });
    const caseLaw = caseLawPage.items || [];

    const ourPoints = Array.isArray(body.our_points) ? body.our_points.slice(0, 40) : [];
    const clauses = Array.isArray(body.contract_clauses) ? body.contract_clauses.slice(0, 30) : [];
    const misstatements = Array.isArray(body.misstatements) ? body.misstatements.slice(0, 30) : [];
    const questionsSoFar = Array.isArray(body.questions) ? body.questions.slice(0, 30) : [];
    const position = typeof body.position === 'string' ? body.position : 'the client';

    const material = `## DOCUMENTS UPLOADED TO THIS MATTER (${count})
${corpus || 'NONE UPLOADED'}${buildExtracts(extracts, caseLaw)}${buildOurPoints(ourPoints)}${buildClauses(clauses)}${buildMisstatements(misstatements)}${mode === 'followup' ? buildAnswers(questionsSoFar) : ''}`;

    if (mode === 'conflict') {
      const answers = Array.isArray(body.answers) ? body.answers.slice(0, 30) : [];
      if (answers.length === 0) return Response.json({ error: 'answers are required' }, { status: 400 });

      const answerBlock = answers
        .map((answer, position2) => {
          const index = Number.isInteger(answer.index) ? answer.index : position2;
          const extras = [
            answer.quote ? `Quote given by the user: "${answer.quote}"` : '',
            answer.document_name ? `Document offered by the user: ${answer.document_name}` : '',
            answer.evidence_text ? `Text of that document:\n${String(answer.evidence_text).slice(0, 2000)}` : '',
          ].filter(Boolean);
          return `### Answer (index ${index})\nQuestion: ${answer.question || ''}\nAnswer: ${answer.answer || ''}${extras.length ? `\n${extras.join('\n')}` : ''}`;
        })
        .join('\n\n');

      const prompt = `You are JurisAI, checking a solicitor's answers against the documents in a UK matter.

${material}

## ANSWERS TO CHECK
${answerBlock}

## YOUR TASK
For every answer decide whether it CONTRADICTS a document above (different date, different amount, different person, different sequence of events, a claim the document is silent on is NOT a contradiction).

Return one result per answer, echoing the index you were given.

For a contradiction:
- conflict: true
- conflict_detail: EXACTLY in the form "[CONFLICT: <document name>, <paragraph reference>]" using the document name and paragraph or page reference as they appear above. If there is no paragraph reference, use the quoted words instead.
- confirm_question: one short question asking the user which is right.

For no contradiction:
- conflict: false, conflict_detail: "", confirm_question: "".

Never invent a document, a paragraph reference or a fact. Only use what is above.`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: CONFLICT_SCHEMA,
      });

      const results = Array.isArray(result?.results) ? result.results : [];
      return Response.json({
        results: results.map((entry, position2) => ({
          index: Number.isInteger(entry.index) ? entry.index : position2,
          conflict: entry.conflict === true,
          conflict_detail: entry.conflict === true ? String(entry.conflict_detail || '') : '',
          confirm_question: entry.conflict === true ? String(entry.confirm_question || '') : '',
        })),
        documents_used: count,
      });
    }

    const round = Number(body.round) > 0 ? Number(body.round) : 1;
    if (mode === 'followup' && round > 3) {
      return Response.json({ error: 'Both follow-up rounds are used up. Draft with these answers.' }, { status: 400 });
    }

    const factPattern = typeof body.fact_pattern === 'string' ? body.fact_pattern.trim() : '';
    const prompt = `You are JurisAI, preparing to ask a UK solicitor the questions needed BEFORE drafting an argument for ${position}.

Matter: ${matter.matter_name || 'unnamed'} | Court: ${matter.court || 'not set'} | Type: ${matter.matter_type || 'not set'}
${factPattern ? `\n## FACT PATTERN AS ENTERED BY THE USER\n${factPattern}\n` : ''}
${material}

## RULES
- Read ONLY the material above. Never state, assume or fill in a fact that is not in it.
- ${mode === 'followup' ? 'Ask at most 5 further questions that close the most important gaps left by the answers above. Do not repeat a question already answered.' : 'Ask between 5 and 12 questions, most important first.'}
- Cover, where relevant: missing facts; exact dates; evidence we hold but have not uploaded; what each side said and in which document; the legal test the argument must meet; why a point was not raised earlier; the outcome we want; the weakness the other side will attack.
- For each question give: "why" (why it matters, one or two sentences), "affects" (which part of the argument it changes: Statement of issues, Legal framework, Factual matrix, Detailed argument, Counter-arguments, or Relief), and "priority" (High, Medium or Low).
- Ask questions only. Do not draft the argument, do not advise, do not answer your own questions.
- If the material already answers something, do not ask about it.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: QUESTION_SCHEMA,
    });

    const raw = Array.isArray(result?.questions) ? result.questions : [];
    const questions = raw
      .filter((entry) => entry && typeof entry.question === 'string' && entry.question.trim())
      .slice(0, 12)
      .map((entry) => ({
        question: entry.question.trim(),
        why: typeof entry.why === 'string' ? entry.why.trim() : '',
        affects: typeof entry.affects === 'string' ? entry.affects.trim() : '',
        priority: normalisePriority(entry.priority),
      }));

    return Response.json({ questions, documents_used: count, extracts_used: extracts.length, round });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}