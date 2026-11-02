import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildMainAuthorityBlock, MAIN_AUTHORITY_RULES } from '../../shared/mainAuthorities.ts';
import { buildAnswers, buildOurPoints, buildClauses, buildMisstatements } from '../../shared/argumentContext.ts';

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

function buildLegalTests(tests: Record<string, unknown>[]) {
  if (!Array.isArray(tests) || tests.length === 0) return '';
  const blocks = tests.map((test, index) => {
    const elements = Array.isArray(test.elements) ? (test.elements as Record<string, string>[]) : [];
    const lines = [`TEST ${index + 1}: ${test.name || 'unnamed test'}${test.source_name ? ` (${test.source_name})` : ''}`];
    elements.forEach((element, position) => {
      const source = element.source_document_name
        ? ` [source: ${element.source_document_name}, ${element.source_paragraph_ref || 'paragraph not recorded'}]`
        : element.source_extract_ref
          ? ` [source: stored extract ${element.source_extract_ref}]`
          : '';
      lines.push(`  Element ${position + 1}: ${element.text || 'no text'}${source}`);
    });
    return lines.join('\n');
  });
  return `\n\n## CONFIRMED LEGAL TESTS - the argument must be organised element by element under each\n${blocks.join('\n\n')}`;
}

function buildDocuments(documents: Record<string, unknown>[]) {
  if (documents.length === 0) return '';
  return `\n\n## Uploaded Documents\n${documents
    .map((doc, idx) => {
      const linkedTo = Array.isArray(doc.linked_to) && doc.linked_to.length > 0
        ? ` (Linked to: ${(doc.linked_to as string[]).join(', ')})`
        : '';
      const content = typeof doc.content === 'string' ? doc.content.slice(0, 5000) : '';
      const id = doc.id ? ` [document id: ${doc.id}]` : '';
      return `### Document ${idx + 1}: ${doc.name || 'Untitled'}${id}${linkedTo}\n${content}`;
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
    const mainAuthorities = Array.isArray(body.main_authorities) ? body.main_authorities.slice(0, 20) : [];
    const questionAnswers = Array.isArray(body.question_answers) ? body.question_answers.slice(0, 30) : [];
    const ourPoints = Array.isArray(body.our_points) ? body.our_points.slice(0, 40) : [];
    const contractClauses = Array.isArray(body.contract_clauses) ? body.contract_clauses.slice(0, 30) : [];
    const misstatements = Array.isArray(body.misstatements) ? body.misstatements.slice(0, 30) : [];
    const legalTests = Array.isArray(body.legal_tests) ? body.legal_tests.slice(0, 4) : [];
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

${expansions ? `## Fact Pattern Expansion (User-Provided Detail)\n${expansions.trim()}` : ''}${issueContext}${buildAuthorities(authorities)}${buildMainAuthorityBlock(mainAuthorities)}${buildDocuments(documents)}${buildAnswers(questionAnswers)}${buildOurPoints(ourPoints)}${buildClauses(contractClauses)}${buildMisstatements(misstatements)}${buildLegalTests(legalTests)}

## Instructions to AI
${MAIN_AUTHORITY_RULES}

When generating arguments:
- Treat the ANSWERS TO THE PREPARATION QUESTIONS as established facts for this version, and write nothing that is not in the material above
- Use OUR POINTS as the spine of the argument, and mark any point with no document reference as [USER STATEMENT - NO DOCUMENT REFERENCE]
- Where a contract clause is relied on, quote it from CONTRACT CLAUSES AND RULES RELIED ON; if the clause text is missing write [RULE TEXT NEEDED]
- Where a fact is needed but not in the material, write [FACT NEEDED: describe what is needed] instead of inventing it
- Where the draft needs a proposition from a main authority and no stored extract supports it, write [EXTRACT NEEDED: <case name>, <proposition>] and never state that proposition as law
- When you rely on a main authority already in the library, quote its stored extract and state the proposition recorded with that extract
- Refer to OUR documents ONLY in this structured form: {{DOC:<document id>|para:<number>}} or {{DOC:<document id>|page:<number>|lines:<a-b>}}, using a document id from the document list. Never describe a document reference in any other way, and never invent a document id, page, line or paragraph number
- Organise the DETAILED ARGUMENT element by element under each confirmed legal test: a heading for the test, then a sub-heading for each element ("Element 1", "Element 2"), with the evidence for that element, its document references, and the conclusion on it. If the evidence for an element is missing write [FACT NEEDED: describe what is needed]
- Never restate a legal test from memory: use the elements exactly as they are given
- Give a paragraph number for one of our documents only when that number appears in the document text above. If it does not, use a page and line reference if the text shows them, otherwise write [DOCUMENT REFERENCE NEEDED: document name] instead of a paragraph number
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

Use formal UK legal language. Cite all authorities properly. Be thorough and persuasive.

End the draft with this exact line on its own:
Draft for review. Check every authority and document reference against the originals before filing. Not legal advice.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
    });

    return Response.json({ argument: typeof result === 'string' ? result : JSON.stringify(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});