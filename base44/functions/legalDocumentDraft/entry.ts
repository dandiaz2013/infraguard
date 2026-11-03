import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildMainAuthorityBlock, MAIN_AUTHORITY_RULES } from '../../shared/mainAuthorities.ts';

// Drafts a document from the Argument Builder work and the actual text of the ticked
// documents. The paragraphs are sent in full, with their document id and paragraph
// number, so every statement in the draft can be tied to the record.

const DOCUMENT_PROMPTS: Record<string, string> = {
  'Particulars of Claim': 'Draft comprehensive Particulars of Claim following CPR rules for UK civil litigation. Include proper headings, numbered paragraphs, clear statement of facts, legal basis for claim, and prayer for relief.',
  'Defence': 'Draft a robust Defence document following CPR rules. Include proper admissions, denials with reasons, counterclaim if applicable, and clear legal arguments.',
  'Witness Statement': 'Draft a formal Witness Statement complying with CPR Part 32 and Practice Direction 32. Include proper heading, statement of truth, chronological narrative, and exhibits references.',
  'Skeleton Argument': 'Draft a persuasive Skeleton Argument for court submission. Include concise statement of issues, legal propositions with authorities, and structured submissions.',
  'Appeal Grounds': 'Draft comprehensive Grounds of Appeal. Include clear identification of errors, legal basis for appeal, and authorities supporting each ground.',
  'Case Summary': 'Draft a detailed Case Summary covering factual background, legal issues, authorities, and case analysis.',
  'Legal Opinion': 'Draft a formal Legal Opinion with clear structure: instructions, facts, issues, legal analysis, authorities, and advice.',
};

const USER_MARKER = '[USER STATEMENT - NO DOCUMENT REFERENCE]';

function text(value: unknown, limit = 200000): string {
  return typeof value === 'string' ? value.slice(0, limit).trim() : '';
}

function list(value: unknown, limit: number): Record<string, any>[] {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function applicationBlock(app: Record<string, any>, order: Record<string, any>, ctx: Record<string, any>): string {
  const lines = [
    `Application: ${app.text || 'not stated'}`,
    `Rule relied on: ${app.rule || 'not stated in the application notice'}`,
    `What the notice asks for: ${app.asks || 'not stated in the application notice'}`,
    `Application notice: ${app.notice_name || 'not in the case file'}${app.notice_date ? `, dated ${app.notice_date}` : ''}`,
    `Order challenged: ${order.name || 'not in the case file'}${order.date ? `, dated ${order.date_text || order.date}` : ', date not confirmed'}`,
    `Our side: ${ctx.ourSide || 'not stated'}`,
    `Court: ${ctx.court || 'not stated'}`,
  ];

  if (!order.found) {
    lines.push(
      '',
      'THE ORDER CHALLENGED IS NOT IN THE SOURCE MATERIAL. Do not quote it, do not describe what it says, and do not invent its date or its terms. Where the draft needs its wording, write [DOCUMENT REFERENCE NEEDED: the order challenged].'
    );
  }

  if (ctx.variation) {
    lines.push(
      '',
      'This is an application to vary or revoke an order. Never ask the court to maintain a decision that the order challenged set aside, and never describe that decision as one the court should keep in place.'
    );
  }

  return lines.join('\n');
}

function labelBlock(labels: Record<string, any>[]): string {
  if (!labels.length) return 'No document labels were supplied.';
  return labels
    .map((label) => {
      const tag = label.label || 'other document';
      return `- ${label.name}${label.date_text ? ` (${label.date_text})` : ''} — ${tag}`;
    })
    .join('\n');
}

function structureBlock(structure: string[]): string {
  if (!structure.length) return '';
  return `\n## STRUCTURE — follow these headings exactly, in this order, with these words\n${structure
    .map((heading) => `- ${heading}`)
    .join('\n')}\n`;
}

function paragraphBlock(paragraphs: Record<string, any>[], labels: Record<string, any>[]): string {
  if (!paragraphs.length) {
    return 'NONE SUPPLIED. Nothing may be quoted and no fact may be stated from a document.';
  }
  const byId = new Map(labels.map((label) => [String(label.id), label]));
  return paragraphs
    .map((paragraph, index) => {
      const label = byId.get(String(paragraph.document_id));
      return [
        `### PARAGRAPH ${index + 1}`,
        `Document: ${paragraph.document_name || 'not recorded'}`,
        `Document id: ${paragraph.document_id || 'not recorded'}`,
        `Reference: ${paragraph.ref || 'not recorded'}`,
        `Label: ${label?.label || 'other document'}${label?.date_text ? ` (${label.date_text})` : ''}`,
        `EXACT TEXT:\n${text(paragraph.text, 20000)}`,
      ].join('\n');
    })
    .join('\n\n');
}

function gatewayBlock(gateway: Record<string, any>[]): string {
  if (!gateway.length) return 'NONE SUPPLIED.';
  return gateway
    .map((issue) => {
      const lines = [
        `#### Gateway ${issue.number}. ${issue.title}`,
        `The question: ${issue.ask || 'not recorded'}`,
        issue.our_answer?.quote
          ? `Our answer: “${issue.our_answer.quote}” (${issue.our_answer.document_name || ''}, ${issue.our_answer.ref || ''})`
          : 'Our answer: nothing in the record answers this.',
        issue.their_answer?.quote
          ? `Their answer: “${issue.their_answer.quote}” (${issue.their_answer.document_name || ''}, ${issue.their_answer.ref || ''})`
          : 'Their answer: nothing in the record answers this for them.',
        `Approach chosen by the lawyer: ${issue.approach || 'not yet chosen - work from the record paragraphs'}`,
        `The lawyer's explanation to the court: ${issue.explanation || 'none supplied'}`,
        `Indicative rating: ${issue.rating || 'not rated'}${issue.status ? ` (${issue.status})` : ''}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

function promptnessBlock(promptness: Record<string, any> | null): string {
  if (!promptness) return 'The interval was not measured: the record does not show both dates.';
  const order = promptness.order;
  const application = promptness.application;
  return [
    order
      ? `The order challenged: ${order.name || 'not recorded'} ${order.ref || ''} — ${order.date_text || 'date not confirmed'}`
      : 'The order challenged: not in the record.',
    application
      ? `The application: ${application.name || 'not recorded'} ${application.ref || ''} — ${application.date_text || 'date not confirmed'}`
      : 'The application: not in the record.',
    promptness.interval ? `The interval between them: ${promptness.interval}.` : 'The interval cannot be measured.',
    promptness.note || '',
  ]
    .filter(Boolean)
    .join('\n');
}

function testsBlock(tests: Record<string, any>[]): string {
  if (!tests.length) return 'No legal test has been confirmed for this matter.';
  return tests
    .map((test) => {
      const elements = (test.elements || [])
        .map(
          (element: Record<string, any>) =>
            `  ${element.number}. ${element.text || ''}${
              element.paragraph_ref ? ` (paragraph ${element.paragraph_ref})` : ''
            }${element.against_us ? ' — counts against us, address it' : ''}`
        )
        .join('\n');
      return `- ${test.name || 'unnamed test'}\n${elements || '  No elements recorded.'}`;
    })
    .join('\n');
}

function extractBlock(extracts: Record<string, any>[]): string {
  if (!extracts.length) {
    return 'NO STORED, CHECKED EXTRACTS. Every proposition of law must be written as [NO EXTRACT: <case name>, <proposition>]. Do not describe what any case is about.';
  }
  return extracts
    .map(
      (extract) =>
        `- ${extract.case_name || 'unnamed authority'} ${extract.citation || ''}, paragraph ${
          extract.paragraph_ref || 'not recorded'
        }${extract.checked ? ' (checked against the official text)' : ' (NOT CHECKED - do not rely on it)'}\n  EXACT TEXT: ${
          extract.extract_text || ''
        }\n  Proposition: ${extract.proposition || 'not stated'}`
    )
    .join('\n');
}

function registerBlock(items: Record<string, any>[]): string {
  if (!items.length) return 'The register is empty.';
  return items
    .map(
      (item) =>
        `- [${item.status || 'Open'}] ${item.title || ''}${item.answer ? ` — answered: “${item.answer}”` : ''}${
          item.reason ? ` (${item.reason})` : ''
        }`
    )
    .join('\n');
}

function userBlock(statements: Record<string, any>[]): string {
  if (!statements.length) return 'NONE SUPPLIED.';
  return statements.map((statement) => `- ${statement.text || ''}`).join('\n');
}

const RULES = `RULES — follow every one:
1. Quote only text that appears in the source paragraphs supplied. Never invent a quotation, a fact, a date, a paragraph number, an exhibit or an authority.
2. Cite the record with the {{DOC}} form and the document id printed beside each paragraph: {{DOC:<document id>|para 46}} or {{DOC:<document id>|page 16|lines 9-12}}. Never write a file name in the prose of the draft.
3. State a legal principle only from a stored, checked extract supplied to you, with the case name and the paragraph and sub-paragraph exactly as stored. Otherwise write [NO EXTRACT: <case name>, <proposition>].
4. Describe an authority only as the stored extract describes it. Never describe what a case is about from memory, and never add a case that is not in the stored extracts.
5. A statement by the other side must read "stated by <party>, <document>, <paragraph>" and must never be presented as established fact.
6. Wording supplied as a statement by the user is used exactly as given and keeps its marker ${USER_MARKER}. Never present it as something in the documents.
7. Where the record does not deal with a point, write [FACT NEEDED: what is needed] and nothing else.
8. Only the document labelled THE ORDER CHALLENGED is the order challenged. Every other order and judgment is an earlier decision, background: describe it as background and give its date.
9. Do not ask the court to maintain a decision that the order challenged set aside.
10. Numbered paragraphs. No commentary about these rules and no summary at the end.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const documentType = text(body.documentType, 80);
    const briefingNotes = text(body.briefingNotes, 20000);
    if (!documentType || !briefingNotes) {
      return Response.json({ error: 'documentType and briefingNotes are required' }, { status: 400 });
    }
    if (!DOCUMENT_PROMPTS[documentType]) {
      return Response.json({ error: 'Unsupported document type' }, { status: 400 });
    }

    const ctx = {
      ourSide: text(body.our_side, 80),
      court: text(body.court, 160),
      variation: body.variation === true,
    };
    const application = body.application && typeof body.application === 'object' ? body.application : {};
    const order = body.order_challenged && typeof body.order_challenged === 'object' ? body.order_challenged : {};
    const labels = list(body.labels, 80);
    const structure = Array.isArray(body.structure) ? body.structure.filter((entry: unknown) => typeof entry === 'string') : [];
    const paragraphs = list(body.record_paragraphs, 160);
    const gateway = list(body.gateway, 10);
    const extracts = list(body.extracts, 80);
    const tests = list(body.legal_tests, 10);
    const registerItems = list(body.register_items, 60);
    const statements = list(body.user_statements, 60);
    const supplementary = text(body.supplementary_statement, 30000);
    const promptness = body.promptness && typeof body.promptness === 'object' ? body.promptness : null;

    const savedArgument = body.argument && typeof body.argument === 'object' ? body.argument : null;
    const argumentContext = savedArgument
      ? `\n## SAVED ARGUMENT (version ${savedArgument.version_number || 1})\nTitle: ${savedArgument.argument_title || ''}\nPosition: ${savedArgument.position || ''}\n\n### Fact pattern:\n${text(savedArgument.fact_pattern, 8000)}\n\n### The argument as last saved (background only - it is not the record):\n${text(savedArgument.argument_text, 30000)}`
      : '';

    const recordDocuments = list(body.record_documents, 30);
    const recordContext = recordDocuments.length === 0
      ? ''
      : `\n\n## THE RECORD INDEX (names and roles only; the text is in the source paragraphs above)\n${recordDocuments
        .map((doc: any) => `- ${doc.name || 'Document'} (${doc.role || 'party not recorded'}, ${doc.record_status || 'filed or served'}${doc.filed_date ? `, ${doc.filed_date}` : ''})`)
        .join('\n')}`;

    const sourceMaterial = list(body.source_material, 40);
    const sourceContext = sourceMaterial.length === 0
      ? ''
      : `\n\n## DOCUMENTS TICKED FOR THIS DRAFT\n${sourceMaterial
        .map((doc: any) => `- ${doc.name || 'Document'} (${doc.category || 'other'}${doc.date ? `, ${doc.date}` : ''}) — ticked as: ${doc.reason || 'chosen by the user'}`)
        .join('\n')}`;

    const authorities = list(body.authorities, 40);
    const mainAuthorities = list(body.main_authorities, 20);
    const authoritiesContext = authorities.length > 0
      ? `\n\nRecorded authorities (do not describe them beyond the stored extracts):\n${authorities
        .map((a: any) => `- ${a.title || ''} (${a.citation || ''})`)
        .join('\n')}`
      : '';

    const prompt = `You are JurisAI, drafting a ${documentType} for the ${ctx.ourSide || 'party'} in ${ctx.court || 'the court'}, for filing.

## THE APPLICATION BEING DRAFTED — state this expressly in the document
${applicationBlock(application, order, ctx)}

## HOW EACH DOCUMENT IS LABELLED
${labelBlock(labels)}
${structureBlock(structure)}
## BRIEFING NOTES FROM THE LAWYER
${briefingNotes}
${argumentContext}
${authoritiesContext}${buildMainAuthorityBlock(mainAuthorities)}

## SOURCE PARAGRAPHS — full text, the only facts and quotations you may use
${paragraphBlock(paragraphs, labels)}

## THE ARGUMENT WORK — this document is built from it
### The seven gateway issues
${gatewayBlock(gateway)}

### Promptness, with both dates
${promptnessBlock(promptness)}

### Confirmed legal test elements
${testsBlock(tests)}

### Stored, checked extracts — the only authority wording you may use
${extractBlock(extracts)}

### The register (answered and open items)
${registerBlock(registerItems)}

### Statements by the user (no document reference - keep the marker)
${userBlock(statements)}
${supplementary ? `\n### Supplementary witness statement supplied by the lawyer (use its facts; it is not the record)\n${supplementary}\n` : ''}
${recordContext}${sourceContext}

${MAIN_AUTHORITY_RULES}

${RULES}

## REQUIREMENTS
- Formal UK legal drafting, in markdown, with clear headings and numbered paragraphs.
- Name the order challenged, with its date, wherever the document refers to it.
- Every factual statement carries a {{DOC}} reference. Every proposition of law carries a stored extract and its paragraph, or a [NO EXTRACT: ...] marker.
- Include a statement of truth where the document type requires one.
- End with: Draft for review. Check every authority against the official judgment and every document reference against the original before filing. Not legal advice.

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