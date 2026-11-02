import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const EXPANSION_LABELS = [
  ['chronology', 'Chronology (Key Events)'],
  ['disputed_facts', 'Disputed Facts'],
  ['undisputed_facts', 'Undisputed Facts'],
  ['legal_issues_raised', 'Legal Issues Raised'],
  ['procedural_history', 'Procedural History'],
  ['loss_harm_risk', 'Loss, Harm, or Risk'],
];

function buildExpansions(expansions: Record<string, string> | undefined) {
  if (!expansions) return '';
  return EXPANSION_LABELS
    .filter(([key]) => typeof expansions[key] === 'string' && expansions[key].trim())
    .map(([key, label]) => `\n### ${label}:\n${expansions[key]}`)
    .join('');
}

function buildAuthorities(authorities: Record<string, string>[]) {
  if (authorities.length === 0) return '';
  return `\n\nRelevant Legal Authorities:\n${authorities
    .map((a) => `- ${a.title || ''} (${a.citation || ''})\n  Principle: ${a.legal_principle || ''}\n  Status: ${a.status || 'Active'}`)
    .join('\n\n')}`;
}

function buildDocuments(documents: Record<string, unknown>[]) {
  if (documents.length === 0) return '';
  return `\n\n## Uploaded Documents\n${documents
    .map((doc, idx) => {
      const linkedTo = Array.isArray(doc.linked_to) && doc.linked_to.length > 0
        ? ` (Linked to: ${(doc.linked_to as string[]).join(', ')})`
        : '';
      const content = typeof doc.content === 'string' ? doc.content.slice(0, 3000) : '';
      return `### Document ${idx + 1}: ${doc.name || 'Untitled'}${linkedTo}\n${content}`;
    })
    .join('\n\n')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const position = typeof body.position === 'string' ? body.position.trim() : '';
    const court = typeof body.court === 'string' ? body.court.trim() : '';
    const factPattern = typeof body.factPattern === 'string' ? body.factPattern.trim() : '';
    if (!position || !court || !factPattern) {
      return Response.json({ error: 'position, court and factPattern are required' }, { status: 400 });
    }

    const matterName = typeof body.matterName === 'string' ? body.matterName : '';
    const matterType = typeof body.matterType === 'string' ? body.matterType : 'N/A';
    const issueTitle = typeof body.issueTitle === 'string' ? body.issueTitle.trim() : '';
    const authorities = Array.isArray(body.authorities) ? body.authorities.slice(0, 40) : [];
    const documents = Array.isArray(body.documents) ? body.documents.slice(0, 10) : [];
    const expansions = buildExpansions(body.expansions);
    const issueContext = issueTitle ? `\n\nLegal Issue: ${issueTitle}` : '';

    const prompt = `You are JurisAI, a UK legal reasoning assistant. Draft a structured court-ready legal argument for ${position}.

## CRITICAL: COURT & JURISDICTION LOCKED
**Court:** ${court}
**Matter Type:** ${matterType}
**Matter:** ${matterName}

YOU MUST:
- Address ONLY ${court} - DO NOT change court level
- Apply practice directions for ${court}
- Use authorities binding on ${court}
- Use procedural language appropriate to ${court}

## Core Fact Pattern (Auto-Populated from Matter)
${factPattern}

${expansions ? `## Fact Pattern Expansion (User-Provided Detail)\n${expansions.trim()}` : ''}${issueContext}${buildAuthorities(authorities)}${buildDocuments(documents)}

## Instructions to AI
When generating arguments:
- Treat auto-populated Matter facts as accurate unless contradicted
- Prioritise user-added expansions
- Identify legally material facts
- Reference uploaded documents as evidence where relevant
- Cross-reference document evidence with legal points
- Ignore emotional language unless legally relevant
- Structure arguments clearly with headings and sub-points
- Where appropriate, flag factual gaps or evidential weaknesses

## Output Requirements
Generate a professional, court-ready legal argument with:

1. **STATEMENT OF ISSUES**
   - Clear identification of legal questions

2. **LEGAL FRAMEWORK**
   - Relevant statutes and legal principles
   - Applicable tests and standards

3. **FACTUAL MATRIX**
   - Key material facts
   - Timeline if relevant

4. **DETAILED ARGUMENT**
   - Step-by-step legal analysis
   - Application of authorities to facts
   - Proper UK citation format
   - Address each element/requirement

5. **COUNTER-ARGUMENTS & REBUTTAL**
   - Anticipate opposing arguments
   - Provide clear rebuttals

6. **CONCLUSION & RELIEF SOUGHT**
   - Summary of argument
   - Remedies requested

Use formal UK legal language. Cite all authorities properly. Be thorough and persuasive.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
    });

    return Response.json({ argument: typeof result === 'string' ? result : JSON.stringify(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});