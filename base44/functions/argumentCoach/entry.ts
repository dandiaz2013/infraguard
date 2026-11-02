import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

function extractStatusLine(status: unknown) {
  return String(status || '').trim().toLowerCase().startsWith('extract checked')
    ? 'CHECKED against the official text - may be described and quoted'
    : 'PROPOSED - NOT CHECKED - may not be described as law';
}

function buildExtractBlock(extracts: Record<string, string>[]) {
  if (extracts.length === 0) return 'NO STORED EXTRACTS. Do not describe what any authority says.';
  return extracts
    .map((extract) =>
      [
        `- ${extract.authority || 'unnamed authority'} ${extract.citation || ''} at ${extract.paragraph_ref || 'no paragraph'}`,
        `  STATUS: ${extractStatusLine(extract.status)}`,
        `  EXACT TEXT: ${String(extract.exact_text || '').slice(0, 1200)}`,
        `  Proposition: ${extract.proposition || 'not stated'}`,
      ].join('\n')
    )
    .join('\n\n');
}

const COACH_SCHEMA = {
  type: 'object',
  properties: {
    strategic_questions: { type: 'array', items: { type: 'string' } },
    practice_direction_check: {
      type: 'object',
      properties: {
        compliant: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
    },
    weaknesses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          weakness: { type: 'string' },
          impact: { type: 'string', enum: ['Critical', 'Moderate', 'Minor'] },
          how_to_fix: { type: 'string' },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    immediate_improvements: { type: 'array', items: { type: 'string' } },
    opponent_counter_arguments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          counter: { type: 'string' },
          how_to_address: { type: 'string' },
          source: { type: 'string' },
        },
      },
    },
    extract_warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          authority: { type: 'string' },
          paragraph_ref: { type: 'string' },
          warning: { type: 'string' },
        },
      },
    },
    overall_assessment: { type: 'string' },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const factPattern = typeof body.factPattern === 'string' ? body.factPattern : '';
    const generatedArgument = typeof body.generatedArgument === 'string' ? body.generatedArgument : '';
    if (!factPattern.trim() && !generatedArgument.trim()) {
      return Response.json({ error: 'factPattern or generatedArgument is required' }, { status: 400 });
    }

    const court = typeof body.court === 'string' && body.court.trim() ? body.court.trim() : 'Not specified';
    const position = typeof body.position === 'string' && body.position.trim() ? body.position.trim() : 'Claimant';
    const matterType = typeof body.matterType === 'string' && body.matterType.trim() ? body.matterType.trim() : 'N/A';
    const authorities = Array.isArray(body.authorities) ? body.authorities.slice(0, 40) : [];
    const extracts = Array.isArray(body.extracts) ? body.extracts.slice(0, 40) : [];

    const prompt = `You are a senior UK barrister coaching a junior colleague. Review this legal argument development and provide strategic guidance.

## MATTER CONTEXT
Court: ${court}
Position: ${position}
Matter Type: ${matterType}

## FACT PATTERN
${factPattern || 'No facts provided yet'}

## GENERATED ARGUMENT
${generatedArgument || 'No argument generated yet'}

## AVAILABLE AUTHORITIES
${authorities.length > 0 ? authorities.map((a) => `- ${a.title || ''} (${a.citation || ''})`).join('\n') : 'None linked'}

## STORED EXTRACTS - the only authority wording you may use
${buildExtractBlock(extracts)}

## RULES ON AUTHORITIES - follow every one
- You may describe what an authority says, or suggest using its wording, ONLY where a stored extract marked CHECKED supports it. Give the authority, citation and paragraph reference.
- If no checked extract supports the point, write [CHECK AGAINST EXTRACT] where the point would go, and nothing more about what the case says.
- Never quote or paraphrase an authority from memory, and never add a case, citation or paragraph that is not in the extracts above.
- Where a stored extract warns against a word, a phrase or an approach, set it out in extract_warnings so the drafter sees the warning.
- Every counter-argument must name the stored extract or the record paragraph it rests on in "source". If it rests on neither, do not list it.

## YOUR COACHING TASK
Provide Socratic guidance to strengthen this argument:

1. **STRATEGIC QUESTIONS**: Ask 3-5 probing questions that make the lawyer think deeper about:
   - Missing elements of the cause of action
   - Weaknesses in reasoning
   - Counter-arguments not addressed
   - Evidential gaps

2. **PRACTICE DIRECTION COMPLIANCE**: 
   - Check compliance with ${court} practice directions
   - Flag any procedural issues
   - Suggest improvements

3. **LEGAL WEAKNESSES**: Identify:
   - Logical gaps in reasoning
   - Missing legal steps
   - Authority gaps (propositions with no stored extract)
   - Risk areas

4. **STRENGTHS TO LEVERAGE**: What's working well that should be expanded?

5. **IMMEDIATE IMPROVEMENTS**: 3-5 specific, actionable suggestions

6. **COUNTER-ARGUMENTS**: What will the opponent say? How to pre-empt?

Be constructive but challenging. Guide, don't tell. Ask questions that prompt better thinking.`;

    const feedback = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: COACH_SCHEMA,
    });

    return Response.json({ feedback });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});