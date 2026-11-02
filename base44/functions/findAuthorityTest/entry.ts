import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MAX_STORE_CHARS = 120000;
const MAX_PROMPT_CHARS = 100000;
const MAX_EXTRACTS = 16;
const MAX_ELEMENTS = 12;
const MAX_QUOTE_CHARS = 1500;
const LICENCE = 'Contains information licensed under the Open Justice Licence v1.0';
const PROPOSED_STATUS = 'Proposed - compare with the official text';

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"');
}

function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr|blockquote|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const PARA_START = /^\s*(\d{1,3})\.\s+/;
const SUB_PRINTED = /^\s*(\d{1,3})\(([0-9a-zA-Z]{1,5})\)\s+/;
const SUB_START = /^\s*\(([0-9a-zA-Z]{1,5})\)\s+/;

// Numbered paragraphs and sub-paragraphs, kept exactly as printed ("39", "39(ii)").
function splitParagraphs(text) {
  const lines = String(text || '').split('\n');
  const paragraphs = [];
  let current = null;

  const push = () => {
    if (current) {
      const body = current.lines.join(' ').replace(/\s+/g, ' ').trim();
      if (body) paragraphs.push({ ref: current.ref, text: body });
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.lines.push('');
      return;
    }
    const para = trimmed.match(PARA_START);
    if (para) {
      push();
      current = { ref: para[1], lines: [trimmed] };
      return;
    }
    const printed = trimmed.match(SUB_PRINTED);
    if (printed) {
      push();
      current = { ref: `${printed[1]}(${printed[2].toLowerCase()})`, lines: [trimmed] };
      return;
    }
    const sub = trimmed.match(SUB_START);
    if (sub && current) {
      const parent = current.ref.split('(')[0];
      push();
      current = { ref: `${parent}(${sub[1].toLowerCase()})`, lines: [trimmed] };
      return;
    }
    if (current) current.lines.push(trimmed);
  });
  push();

  if (paragraphs.length > 0) return paragraphs;

  // No printed numbers: keep the text as un-numbered blocks so references are still checkable.
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length > 40)
    .map((block, index) => ({ ref: `block ${index + 1}`, text: block }));
}

function fold(value) {
  return String(value || '')
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201f\u2033]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuotes(value) {
  return String(value || '')
    .trim()
    .replace(/^["'\u2018\u2019\u201c\u201d]+/, '')
    .replace(/["'\u2018\u2019\u201c\u201d]+$/, '')
    .trim();
}

function normaliseRef(value) {
  return String(value || '')
    .trim()
    .replace(/^(paragraph|paragraphs|para|paras|p)\.?\s*/i, '')
    .replace(/[.\s]+$/, '')
    .replace(/\s+/g, '');
}

function buildPromptText(paragraphs) {
  const lines = paragraphs.map((paragraph) => `${paragraph.ref}. ${paragraph.text}`);
  const joined = lines.join('\n\n');
  return joined.length > MAX_PROMPT_CHARS ? joined.slice(0, MAX_PROMPT_CHARS) : joined;
}

function buildPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return 'None recorded.';
  return points
    .slice(0, 40)
    .map((point) => `- [${String(point.kind || 'point').slice(0, 20)}] ${String(point.text || '').slice(0, 400)}`)
    .join('\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) => (error.status === 401 ? null : Promise.reject(error)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const caseLawId = typeof body.case_law_id === 'string' ? body.case_law_id.trim() : '';
    if (!caseLawId) return Response.json({ error: 'case_law_id is required' }, { status: 400 });

    const matterId = typeof body.matter_id === 'string' ? body.matter_id.trim() : '';
    const record = await base44.entities.CaseLaw.get(caseLawId).catch((error) =>
      error.status === 404 ? null : Promise.reject(error)
    );
    if (!record) return Response.json({ error: 'Authority not found' }, { status: 404 });

    const sourceUrl = String(record.official_url || record.url || '');
    let text = typeof body.text === 'string' ? body.text.trim() : '';
    let sourceKind = text ? 'pasted' : 'official_url';
    let note = '';

    // One document, one fetch, only because the user pressed the button.
    if (!text) {
      if (!/^https?:\/\//i.test(sourceUrl)) {
        return Response.json(
          { error: 'No official link is stored for this authority. Paste or upload the judgment text instead.' },
          { status: 400 }
        );
      }
      const response = await fetch(sourceUrl, {
        headers: { 'user-agent': 'JurisAI/1.0 (single judgment fetch for legal research)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        return Response.json(
          { error: `The official page returned ${response.status}. Paste or upload the judgment text instead.` },
          { status: 502 }
        );
      }
      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();
      text = /html/i.test(contentType) || /<html/i.test(raw.slice(0, 600)) ? htmlToText(raw) : raw;
      note = `Fetched once from ${sourceUrl}`;
    }

    if (text.length < 200) {
      return Response.json({ error: 'That text is too short to contain a judgment with numbered paragraphs.' }, { status: 400 });
    }

    const truncated = text.length > MAX_STORE_CHARS;
    const storedText = truncated ? text.slice(0, MAX_STORE_CHARS) : text;
    const paragraphs = splitParagraphs(storedText);
    if (paragraphs.length === 0) {
      return Response.json({ error: 'No paragraphs could be read from that text.' }, { status: 400 });
    }

    const source = await base44.entities.AuthoritySource.create({
      case_law_id: caseLawId,
      source_url: sourceUrl,
      source_kind: sourceKind,
      text: storedText,
      char_count: text.length,
      truncated,
      paragraph_count: paragraphs.length,
      licence: LICENCE,
      fetched_date: new Date().toISOString(),
      note: truncated ? `${note}${note ? '. ' : ''}Stored text truncated at ${MAX_STORE_CHARS} characters.` : note,
    });

    const prompt = `You read ONE UK judgment and propose the paragraphs that state a legal test or principle. You may use ONLY the judgment text below.

## ABSOLUTE RULES
- Use only the text below. Never use memory, other cases, or outside knowledge.
- Every extract must be copied character for character from the paragraph you name. Do not correct spelling, punctuation or wording.
- Name the paragraph exactly as printed, including any sub-paragraph: "39", "39(ii)", "41(a)".
- If the text states no legal test or principle, return empty arrays.
- Maximum ${MAX_EXTRACTS} extracts, maximum ${MAX_ELEMENTS} elements.

## OUR POINTS AND MISSTATEMENTS (what an extract may help or undermine)
${buildPoints(body.points)}

## JUDGMENT TEXT (paragraphs as printed)
${buildPromptText(paragraphs)}

## WHAT TO RETURN
1. extracts: the paragraphs that state a legal test, a principle or a relevant warning. For each: the paragraph reference, the exact wording, a one-line proposition, whether it helps us, hurts us or both, and which of our points or misstatements (worded as above) it supports or undermines.
2. adverse: paragraphs that cut against us (for example on delay, finality, known or knowable facts, prejudice), each with its exact wording and why.
3. test: the elements of the legal test the judgment sets out, each tied to a paragraph reference. Include the factors that count against an applicant (known or knowable facts, delay, prejudice, finality) as elements to address, marked against_us true, rather than leaving them out.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          extracts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                paragraph_ref: { type: 'string' },
                exact_text: { type: 'string' },
                proposition: { type: 'string' },
                helps_hurts: { type: 'string' },
                supports: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { kind: { type: 'string' }, text: { type: 'string' } },
                  },
                },
              },
              required: ['paragraph_ref', 'exact_text', 'proposition'],
            },
          },
          adverse: {
            type: 'array',
            items: {
              type: 'object',
              properties: { paragraph_ref: { type: 'string' }, exact_text: { type: 'string' }, why: { type: 'string' } },
              required: ['paragraph_ref', 'exact_text'],
            },
          },
          test: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              elements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    paragraph_ref: { type: 'string' },
                    against_us: { type: 'boolean' },
                  },
                  required: ['text', 'paragraph_ref'],
                },
              },
            },
          },
        },
        required: ['extracts'],
      },
    });

    const raw = typeof result === 'string' ? JSON.parse(result) : result || {};
    const byRef = new Map(paragraphs.map((paragraph) => [paragraph.ref, paragraph.text]));

    const refContaining = (quote) => {
      const folded = fold(quote);
      if (!folded) return '';
      const found = paragraphs.find((paragraph) => fold(paragraph.text).includes(folded));
      return found ? found.ref : '';
    };

    const candidates = [
      ...(Array.isArray(raw.extracts) ? raw.extracts : []),
      ...(Array.isArray(raw.adverse)
        ? raw.adverse.map((entry) => ({
            paragraph_ref: entry.paragraph_ref,
            exact_text: entry.exact_text,
            proposition: entry.why || 'Cuts against the application.',
            helps_hurts: 'Hurts us',
          }))
        : []),
    ];

    const verified = [];
    const seen = new Set();
    let discarded = 0;

    candidates.slice(0, MAX_EXTRACTS * 2).forEach((candidate) => {
      const quote = stripQuotes(candidate.exact_text).slice(0, MAX_QUOTE_CHARS);
      if (!quote || quote.length < 30) {
        discarded += 1;
        return;
      }
      const claimed = normaliseRef(candidate.paragraph_ref);
      const ref = byRef.has(claimed) && fold(byRef.get(claimed)).includes(fold(quote)) ? claimed : refContaining(quote);
      if (!ref || !fold(byRef.get(ref)).includes(fold(quote))) {
        discarded += 1;
        return;
      }
      const key = `${ref}::${fold(quote)}`;
      if (seen.has(key)) return;
      seen.add(key);
      verified.push({
        paragraph_ref: ref,
        extract_text: quote,
        proposition: String(candidate.proposition || '').slice(0, 400),
        helps_hurts: /hurt|against/i.test(String(candidate.helps_hurts || ''))
          ? 'Hurts us'
          : /both|mixed/i.test(String(candidate.helps_hurts || ''))
            ? 'Both'
            : 'Helps us',
        supports: (Array.isArray(candidate.supports) ? candidate.supports : [])
          .slice(0, 4)
          .map((entry) => ({
            kind: /misstatement/i.test(String(entry.kind || '')) ? 'misstatement' : 'our point',
            text: String(entry.text || '').slice(0, 300),
          }))
          .filter((entry) => entry.text),
      });
    });

    const savedExtracts = verified.length
      ? await base44.entities.AuthorityExtract.bulkCreate(
          verified.slice(0, MAX_EXTRACTS).map((extract) => ({
            case_law_id: caseLawId,
            paragraph_ref: extract.paragraph_ref,
            extract_text: extract.extract_text,
            proposition: extract.proposition,
            helps_hurts: extract.helps_hurts,
            supports: extract.supports,
            source_url: sourceUrl,
            source_id: source.id,
            status: PROPOSED_STATUS,
            matter_ids: matterId ? [matterId] : [],
            added_date: new Date().toISOString(),
          }))
        )
      : [];

    const idByRef = new Map();
    savedExtracts.forEach((saved) => {
      if (!idByRef.has(saved.paragraph_ref)) idByRef.set(saved.paragraph_ref, saved.id);
    });

    let test = null;
    const testElements = Array.isArray(raw.test?.elements) ? raw.test.elements.slice(0, MAX_ELEMENTS) : [];
    if (matterId && testElements.length > 0) {
      const elements = testElements
        .map((element) => {
          const claimed = normaliseRef(element.paragraph_ref);
          const ref = byRef.has(claimed) ? claimed : refContaining(String(element.text || ''));
          return {
            text: String(element.text || '').slice(0, 500),
            paragraph_ref: ref,
            against_us: element.against_us === true,
          };
        })
        .filter((element) => element.text && element.paragraph_ref && idByRef.has(element.paragraph_ref))
        .map((element, index) => ({
          number: index + 1,
          text: element.text,
          source_extract_id: idByRef.get(element.paragraph_ref),
          source_paragraph_ref: element.paragraph_ref,
          source_quote: verified.find((entry) => entry.paragraph_ref === element.paragraph_ref)?.extract_text || '',
          against_us: element.against_us,
          user_confirmed: false,
        }));

      if (elements.length > 0) {
        test = await base44.entities.LegalTest.create({
          matter_id: matterId,
          name: String(raw.test?.name || `${record.name || 'Authority'} test`).slice(0, 200),
          source_case_law_id: caseLawId,
          source_extract_ids: [...new Set(elements.map((element) => element.source_extract_id))],
          elements,
          notes: `Proposed from the stored judgment text of ${record.name || 'the authority'}. Check every element against the official text before confirming.`,
          status: 'Proposed',
        });
      }
    }

    return Response.json({
      source: { id: source.id, source_url: sourceUrl, licence: LICENCE, truncated, paragraph_count: paragraphs.length },
      extracts: savedExtracts,
      discarded,
      proposed: verified.length,
      test,
      note,
      footer: 'Draft for review. Check every authority against the official judgment before filing. Not legal advice.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}