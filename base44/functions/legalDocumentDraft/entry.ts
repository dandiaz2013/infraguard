import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const DOCUMENT_PROMPTS: Record<string, string> = {
  'Particulars of Claim': 'Draft comprehensive Particulars of Claim following CPR rules for UK civil litigation. Include proper headings, numbered paragraphs, clear statement of facts, legal basis for claim, and prayer for relief.',
  'Defence': 'Draft a robust Defence document following CPR rules. Include proper admissions, denials with reasons, counterclaim if applicable, and clear legal arguments.',
  'Witness Statement': 'Draft a formal Witness Statement complying with CPR Part 32 and Practice Direction 32. Include proper heading, statement of truth, chronological narrative, and exhibits references.',
  'Skeleton Argument': 'Draft a persuasive Skeleton Argument for court submission. Include concise statement of issues, legal propositions with authorities, and structured submissions.',
  'Appeal Grounds': 'Draft comprehensive Grounds of Appeal. Include clear identification of errors, legal basis for appeal, and authorities supporting each ground.',
  'Case Summary': 'Draft a detailed Case Summary covering factual background, legal issues, authorities, and case analysis.',
  'Legal Opinion': 'Draft a formal Legal Opinion with clear structure: instructions, facts, issues, legal analysis, authorities, and advice.',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const documentType = typeof body.documentType === 'string' ? body.documentType.trim() : '';
    const briefingNotes = typeof body.briefingNotes === 'string' ? body.briefingNotes.trim() : '';
    if (!documentType || !briefingNotes) {
      return Response.json({ error: 'documentType and briefingNotes are required' }, { status: 400 });
    }
    if (!DOCUMENT_PROMPTS[documentType]) {
      return Response.json({ error: 'Unsupported document type' }, { status: 400 });
    }

    const savedArgument = body.argument && typeof body.argument === 'object' ? body.argument : null;
    const argumentContext = savedArgument
      ? `\n\n## SAVED ARGUMENT (Version ${savedArgument.version_number})\n**Title:** ${savedArgument.argument_title}\n**Position:** ${savedArgument.position}\n**Court:** ${savedArgument.court}\n\n### Fact Pattern:\n${savedArgument.fact_pattern}\n\n### Generated Argument:\n${savedArgument.argument_text || ''}`
      : '';

    const authorities = Array.isArray(body.authorities) ? body.authorities.slice(0, 40) : [];
    const authoritiesContext = authorities.length > 0
      ? `\n\nRelevant Legal Authorities:\n${authorities
        .map((a) => `- ${a.title || ''} (${a.citation || ''})\n  Legal Principle: ${a.legal_principle || ''}\n  Relevance: ${a.relevance || ''}`)
        .join('\n\n')}`
      : '';

    const prompt = `${DOCUMENT_PROMPTS[documentType]}

Briefing Notes:
${briefingNotes}
${argumentContext}
${authoritiesContext}

Requirements:
- Use formal UK legal language and formatting
- Include proper citations in UK format
- Structure with clear headings and numbered paragraphs
- Be comprehensive and professionally drafted
- Include statement of truth where appropriate
- Format in markdown with proper hierarchy

Generate the complete ${documentType}:`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
    });

    return Response.json({ content: typeof result === 'string' ? result : JSON.stringify(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});