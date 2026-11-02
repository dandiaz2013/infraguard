import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
const MAX_EXTRACT_CHARS = 1200;

function buildExtractList(extracts: Record<string, unknown>[], caseLaw: Record<string, unknown>[]) {
  if (extracts.length === 0) return 'NO STORED EXTRACTS ARE AVAILABLE.';
  return extracts
    .slice(0, 60)
    .map((extract) => {
      const record = caseLaw.find((entry) => entry.id === extract.case_law_id) || {};
      return [
        `- Extract id: ${extract.id}`,
        `  Case: ${record.name || 'unnamed authority'} ${record.neutral_citation || ''}`,
        `  Paragraph: ${extract.paragraph_ref || 'no paragraph reference'}`,
        `  EXACT TEXT: ${String(extract.extract_text || '').slice(0, MAX_EXTRACT_CHARS)}`,
        `  Proposition: ${extract.proposition || 'not stated'}`,
      ].join('\n');
    })
    .join('\n\n');
}

function listOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  const page = value as { items?: Record<string, unknown>[] } | null;
  return page && Array.isArray(page.items) ? page.items : [];
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

    // The test comes only from the main authority named for THIS application. Never from
    // the judgment being challenged.
    const wantedId = typeof body.case_law_id === 'string' ? body.case_law_id.trim() : '';
    const mainRecords = await base44.entities.CaseLaw.filter({ is_main: true });
    const caseLaw = wantedId
      ? mainRecords.filter((record: Record<string, unknown>) => record.id === wantedId)
      : mainRecords.slice(0, 1);
    if (caseLaw.length === 0) {
      return Response.json(
        { error: 'Name the main authority for this application before a test can be proposed.' },
        { status: 400 }
      );
    }
    const extracts = listOf(await base44.entities.AuthorityExtract.list('-added_date', 100)).filter((extract) =>
      caseLaw.some((record) => record.id === extract.case_law_id)
    );

    const prompt = `You propose a legal test for a UK matter. You may use ONLY the material supplied below.

## MATTER
${matter?.matter_name || 'unnamed matter'} | ${matter?.matter_type || 'type not recorded'} | Court: ${matter?.court || 'not recorded'}

## ABSOLUTE RULES
- The test and every element must come from the EXACT TEXT or the proposition of a stored extract below, and from nowhere else.
- The authority below is the main authority named for this application. The judgment being challenged is NOT a source: any test it applied is background only.
- Never recite a test, an element, a case, a citation or a quotation from memory. If the sources do not state a test, return an empty tests array.
- Every element must carry source_extract_id (copied exactly from "Extract id:" above) and its paragraph reference. If you cannot do that for an element, leave the element out.
- Do not use the general law, your own knowledge, or any case not listed below.
- Maximum 4 tests, maximum 8 elements each.

## MAIN AUTHORITY EXTRACTS (the only quotable wording)
${buildExtractList(extracts, caseLaw)}

Return the tests you can support, element by element.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          tests: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                source_case_law_id: { type: 'string' },
                notes: { type: 'string' },
                elements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      number: { type: 'number' },
                      text: { type: 'string' },
                      source_extract_id: { type: 'string' },
                      source_document_name: { type: 'string' },
                      source_paragraph_ref: { type: 'string' },
                      source_quote: { type: 'string' },
                    },
                    required: ['text'],
                  },
                },
              },
              required: ['name', 'elements'],
            },
          },
        },
        required: ['tests'],
      },
    });

    const raw = typeof result === 'string' ? JSON.parse(result) : result;
    const knownExtractIds = new Set(extracts.map((extract) => extract.id));

    const tests = (Array.isArray(raw?.tests) ? raw.tests : [])
      .slice(0, 4)
      .map((test: Record<string, unknown>) => {
        const elements = (Array.isArray(test.elements) ? test.elements : [])
          .slice(0, 8)
          .map((element: Record<string, unknown>) => ({
            text: String(element.text || '').trim(),
            source_extract_id: knownExtractIds.has(String(element.source_extract_id || ''))
              ? String(element.source_extract_id)
              : '',
            source_document_name: String(element.source_document_name || '').slice(0, 200),
            source_paragraph_ref: String(element.source_paragraph_ref || '').slice(0, 40),
            source_quote: String(element.source_quote || '').slice(0, 1200),
          }))
          .filter((element: { text: string; source_extract_id: string }) => element.text && element.source_extract_id);

        return {
          name: String(test.name || 'Legal test').slice(0, 200),
          source_case_law_id: caseLaw.some((record) => record.id === test.source_case_law_id)
            ? String(test.source_case_law_id)
            : '',
          notes: String(test.notes || '').slice(0, 1000),
          elements,
        };
      })
      .filter((test: { elements: unknown[] }) => test.elements.length > 0);

    // Deterministic: a library authority with no stored extract cannot have a test proposed.
    const extractNeeded = caseLaw
      .filter((record) => !extracts.some((extract) => extract.case_law_id === record.id))
      .slice(0, 8)
      .map((record) => ({
        case_law_id: record.id,
        case_name: record.name || 'unnamed authority',
        citation: record.neutral_citation || '',
        proposition: String(record.summary || (Array.isArray(record.principles) ? record.principles[0] : '') || '').slice(0, 300),
      }));

    return Response.json({ tests, extract_needed: extractNeeded, documents_used: count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});