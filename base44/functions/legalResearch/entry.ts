import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    issue_analysis: {
      type: 'object',
      properties: {
        core_issue: { type: 'string' },
        area_of_law: { type: 'string' },
        key_concepts: { type: 'array', items: { type: 'string' } },
      },
    },
    authorities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          citation: { type: 'string' },
          title: { type: 'string' },
          court: { type: 'string' },
          year: { type: 'string' },
          validity_status: { type: 'string' },
          legal_principle: { type: 'string' },
          relevance: { type: 'string' },
          key_quote: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const researchQuery = typeof body.researchQuery === 'string' ? body.researchQuery.trim() : '';
    if (!researchQuery) return Response.json({ error: 'researchQuery is required' }, { status: 400 });

    const prompt = `You are a UK legal research assistant. Analyze the following legal issue and identify relevant UK legal authorities (case law, statutes, regulations).

Legal Issue/Query: ${researchQuery}

Please provide:
1. Analysis of the core legal issue and area of law
2. A list of 5-8 relevant UK legal authorities
3. For each authority, include:
   - Type (Case Law, Statute, Statutory Instrument, etc.)
   - Full citation in proper UK legal format
   - Court (for cases) or year of enactment
   - Current validity status (Active/Overruled/Distinguished/Superseded)
   - Key legal principle or holding
   - Brief explanation of relevance (2-3 sentences)
   - One important quote if applicable
   - URL to find the full text if available

Focus on recent and binding authorities. Prioritize Supreme Court, Court of Appeal, and High Court decisions. Include relevant statutory provisions. Verify each authority is current and not overruled.`;

    const research = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: RESEARCH_SCHEMA,
    });

    return Response.json({ research });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});