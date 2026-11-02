import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildEvidenceCorpus } from '../../shared/argumentContext.ts';
import { caseFileDocuments } from '../../shared/caseFile.ts';

const SAFETY_FOOTER =
  'Draft for review. Check every authority and document reference against the originals before filing. Not legal advice.';

const MAX_FILES = 20;
const MAX_FACT_ITEMS = 20;

function listOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  const page = value as { items?: Record<string, unknown>[] } | null;
  return page && Array.isArray(page.items) ? page.items : [];
}

function buildTestBlock(tests: Record<string, unknown>[]) {
  return tests
    .map((test, index) => {
      const elements = Array.isArray(test.elements) ? (test.elements as Record<string, unknown>[]) : [];
      const lines = ["TEST " + (index + 1) + " (test id: " + test.id + "): " + (test.name || "unnamed test")];
      elements.forEach((element, position) => {
        let source = "";
        if (element.source_document_name) {
          source = " [source: " + element.source_document_name + ", " + (element.source_paragraph_ref || "paragraph not recorded") + "]";
        } else if (element.source_extract_id) {
          source = " [source: stored authority extract]";
        }
        lines.push("  Element " + (position + 1) + ": " + (element.text || "no text") + source);
      });
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildPrompt(tests: Record<string, unknown>[], ourPoints: Record<string, string>[], corpus: string, count: number, matterLine: string, pointLines: string) {
  return [
    "You check the witness statements of a UK party against the elements of a confirmed legal test. Use ONLY the material below.",
    "",
    "## MATTER",
    matterLine,
    "",
    "## CONFIRMED LEGAL TESTS - the elements to check",
    buildTestBlock(tests),
    "",
    "## OUR POINTS",
    pointLines || "NONE RECORDED",
    "",
    "## UPLOADED DOCUMENTS (" + count + " read). Categories identify whose document it is.",
    corpus || "NO DOCUMENTS UPLOADED",
    "",
    "## ABSOLUTE RULES",
    "- Use only the text of the documents above. Never invent a fact, date, document, exhibit, paragraph number or quotation.",
    "- Write a document reference as [Document: exact file name, para N] and only where you can see that paragraph in the text.",
    "- Copy every quote character for character out of the document.",
    "- Status must be exactly one of: Covered, Partly covered, Not covered.",
    "- Covered means our own witness statement or an exhibit deals with the element and you can quote it. Partly covered means part of the element is dealt with and you say what is missing. Not covered means our documents do not deal with it.",
    "- Our witness statements are the case file documents in the Witness statements category whose party is Ours. The other side statement, the application notice, the judgment and every other document are NOT our evidence: use them only in other_side.",
    "- Never state what the law is. The legal bridge is described as an issue counsel must address in submissions (counsel needs to address whether ...), never as a legal conclusion.",
    "- The fact list contains FACTS ONLY: no case law, no legal argument, no opinion on the law, no invented dates or exhibits.",
    "",
    "## OUTPUT",
    "1. element_results: one entry per element of each test, with status, covered_where, quote, missing, bridge, other_side.",
    "2. point_results: one entry per Our Point, with status, covered_where, quote, missing.",
    "3. gap_note: a markdown document headed COUNSEL GAP NOTE. For each element: a heading with the test and element, then Status, Where covered, What is missing, Issue for submissions. Include the document references. End with the line: " + SAFETY_FOOTER,
    "4. fact_list: prompts the witness must answer, each phrased as an instruction in the second person (State when and how you first learned ..., Exhibit the contract clause on ...), with the element it supports and the document it would be exhibited from. Maximum " + MAX_FACT_ITEMS + " items.",
  ].join("\n");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) => (error.status === 401 ? null : Promise.reject(error)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matterId = typeof body.matter_id === 'string' ? body.matter_id.trim() : '';
    if (!matterId) return Response.json({ error: 'matter_id is required' }, { status: 400 });

    const matter = await base44.entities.Matter.get(matterId);
    const tests = listOf(await base44.entities.LegalTest.filter({ matter_id: matterId, status: 'Confirmed by user' }));
    if (tests.length === 0) {
      return Response.json({ error: 'Confirm a legal test before running the gap analysis.' });
    }

    const files = await caseFileDocuments(base44, matterId);
    const ourPoints = Array.isArray(body.our_points) ? body.our_points.slice(0, 40) : [];
    const built = buildEvidenceCorpus(files as never, MAX_FILES, 6000, 40000);

    const matterLine = [matter?.matter_name || "unnamed matter", "Court: " + (matter?.court || "not recorded")].join(" | ");
    const pointLines = ourPoints
      .map((point: Record<string, string>) => {
        const reference = point.document_name
          ? " [recorded reference: " + point.document_name + (point.paragraph_ref ? ", " + point.paragraph_ref : "") + "]"
          : "";
        return "- " + (point.text || "point with no text") + reference;
      })
      .join("\n");

    const prompt = buildPrompt(tests, ourPoints, built.corpus, built.count, matterLine, pointLines);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          element_results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                test_id: { type: 'string' },
                test_name: { type: 'string' },
                element_number: { type: 'number' },
                element_text: { type: 'string' },
                status: { type: 'string' },
                covered_where: { type: 'string' },
                quote: { type: 'string' },
                missing: { type: 'string' },
                bridge: { type: 'string' },
                other_side: { type: 'string' },
              },
              required: ['status'],
            },
          },
          point_results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                point: { type: 'string' },
                status: { type: 'string' },
                covered_where: { type: 'string' },
                quote: { type: 'string' },
                missing: { type: 'string' },
              },
              required: ['status'],
            },
          },
          gap_note: { type: 'string' },
          fact_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                element: { type: 'string' },
                prompt: { type: 'string' },
                document_name: { type: 'string' },
                paragraph_ref: { type: 'string' },
              },
              required: ['prompt'],
            },
          },
        },
        required: ['element_results', 'gap_note', 'fact_list'],
      },
    });

    const raw = typeof result === 'string' ? JSON.parse(result) : result;
    const statusOf = (value: unknown) => {
      const text = String(value || '').toLowerCase();
      if (text.startsWith('partly')) return 'Partly covered';
      if (text.startsWith('covered')) return 'Covered';
      return 'Not covered';
    };

    const elementResults = (Array.isArray(raw?.element_results) ? raw.element_results : []).map(
      (row: Record<string, unknown>) => ({
        test_id: String(row.test_id || ''),
        test_name: String(row.test_name || ''),
        element_number: Number(row.element_number || 0),
        element_text: String(row.element_text || ''),
        status: statusOf(row.status),
        covered_where: String(row.covered_where || ''),
        quote: String(row.quote || ''),
        missing: String(row.missing || ''),
        bridge: String(row.bridge || ''),
        other_side: String(row.other_side || ''),
      })
    );

    const pointResults = (Array.isArray(raw?.point_results) ? raw.point_results : []).map(
      (row: Record<string, unknown>) => ({
        point: String(row.point || ''),
        status: statusOf(row.status),
        covered_where: String(row.covered_where || ''),
        quote: String(row.quote || ''),
        missing: String(row.missing || ''),
      })
    );

    const factList = (Array.isArray(raw?.fact_list) ? raw.fact_list : [])
      .slice(0, MAX_FACT_ITEMS)
      .map((row: Record<string, unknown>, index: number) => ({
        key: 'fact-' + (index + 1),
        element: String(row.element || ''),
        prompt: String(row.prompt || ''),
        document_name: String(row.document_name || ''),
        paragraph_ref: String(row.paragraph_ref || ''),
      }))
      .filter((row: { prompt: string }) => row.prompt.trim());

    const summary = {
      total: elementResults.length,
      covered: elementResults.filter((row: { status: string }) => row.status === 'Covered').length,
      partly: elementResults.filter((row: { status: string }) => row.status === 'Partly covered').length,
      not_covered: elementResults.filter((row: { status: string }) => row.status === 'Not covered').length,
    };

    let gapNote = typeof raw?.gap_note === 'string' ? raw.gap_note.trim() : '';
    if (!gapNote.includes(SAFETY_FOOTER)) gapNote = gapNote ? gapNote + "\n\n" + SAFETY_FOOTER : SAFETY_FOOTER;

    return Response.json({
      test_ids: tests.map((test) => test.id),
      element_results: elementResults,
      point_results: pointResults,
      gap_note: gapNote,
      fact_list: factList,
      summary,
      documents_used: built.count,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});