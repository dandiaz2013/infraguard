import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

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
   - Authority gaps (cases/statutes not cited but should be)
   - Risk areas

4. **STRENGTHS TO LEVERAGE**: What's working well that should be expanded?

5. **IMMEDIATE IMPROVEMENTS**: 3-5 specific, actionable suggestions

6. **COUNTER-ARGUMENTS**: What will the opponent say? How to pre-empt?

Be constructive but challenging. Guide, don't tell. Ask questions that prompt better thinking.`;

    const feedback = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: COACH_SCHEMA,
    });

    return Response.json({ feedback });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});