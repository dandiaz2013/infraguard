// Deterministic checks for main-authority extracts. No AI.

export const CHECKED = 'Extract checked against official text';
export const NOT_CHECKED = 'Not checked';
export const NO_EXTRACT_MARKER = '[NO EXTRACT - PARAGRAPH NEEDED]';
export const NOT_CHECKED_MARKER = '[NOT CHECKED - VERIFY BEFORE USE]';

export function isChecked(record) {
  return record?.check_status === CHECKED;
}

export function normalise(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildCheckPack(record, extracts) {
  const lines = [
    `CASE: ${record.name || ''} | ${record.neutral_citation || 'no citation'} | ${record.court || 'no court'} | ${record.year || 'no year'} | ${record.official_url || record.url || 'no official link'}`,
  ];

  if (!extracts || extracts.length === 0) {
    lines.push('NO EXTRACTS STORED FOR THIS AUTHORITY');
  } else {
    extracts.forEach((extract) => {
      lines.push('---');
      lines.push(`PARAGRAPH: ${extract.paragraph_ref || 'no paragraph reference'}`);
      lines.push(`EXACT TEXT: ${extract.extract_text || ''}`);
      lines.push(`PROPOSITION WE RELY ON: ${extract.proposition || 'not stated'}`);
    });
  }

  lines.push('---');
  lines.push('QUESTIONS:');
  lines.push('1) Is the citation correct?');
  lines.push('2) Does the paragraph number match the official text?');
  lines.push('3) Does the wording match exactly?');
  lines.push('4) Does this paragraph actually support the proposition?');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Quotation parsing
// A quote mark is only paired with its closing mark inside one sentence, so a
// stray mark, a heading or an unclosed quotation can never produce a "quote".
// ---------------------------------------------------------------------------

const MIN_QUOTE = 12;
export const QUOTE_MAX = 400;

const OPENERS = ['“', '"', '„', '«'];
const CLOSERS = { '“': ['”', '“'], '„': ['“', '”', '"'], '«': ['»'], '"': ['"', '”'] };

const ABBREVIATION = /(?:^|[\s(“"])(?:v|vs|no|nos|para|paras|p|pp|cl|art|s|ss|mr|mrs|ms|dr|j|lj|jj|ltd|co|st|cf|eg|ie|etc)\.$/i;

const CASE_NAME = /\b[A-Z][A-Za-z’'&.\-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z’'.\-]+)?\s+v\.?\s+[A-Z][A-Za-z’'&.\-]+/;
const NEUTRAL_CITE = /\[\d{4}\]\s*(?:UKSC|UKHL|UKPC|EWCA|EWHC|EWCOP|EWFC|UKUT|UKFTT|UKAIT|EWCR|EWComm|Ch|AC|All\s?ER|WLR|QB|KB|Fam|FLR|ICR|IRLR)\b/i;
const SPEAKING_VERB = /\b(?:held|holds|observed|stated|states|said|says|remarked|noted|concluded|explained|reasoned|decided|submitted|contended|argued|per)\b/i;
const COURT_WORD = /\b(?:court|court of appeal|supreme court|high court|house of lords|privy council|judge|master|deputy master|justice|justices|lords|lady|tribunal|chancellor)\b/i;

const HEADING_LINE = /^[ \t]*(?:#{1,6}[ \t]*(.+?)[ \t]*|(?:\*\*|__)(.+?)(?:\*\*|__)[ \t]*)$/gm;
const AUTHORITY_SECTION = /authorit|legal framework|case law|statutory framework/i;

// Split into sentence-sized spans. A new line always ends a span.
export function splitSentences(text) {
  const source = String(text || '');
  const spans = [];
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\n') {
      spans.push({ start, end: index, text: source.slice(start, index) });
      start = index + 1;
      continue;
    }
    if (char !== '.' && char !== '!' && char !== '?') continue;
    if (!/^\s/.test(source.slice(index + 1, index + 2))) continue;
    if (char === '.' && ABBREVIATION.test(source.slice(Math.max(0, index - 14), index + 1))) continue;
    spans.push({ start, end: index + 1, text: source.slice(start, index + 1) });
    start = index + 1;
  }

  if (start < source.length) spans.push({ start, end: source.length, text: source.slice(start) });
  return spans.filter((span) => span.text.trim());
}

export function quotesInSentence(sentence) {
  const value = String(sentence || '');
  const found = [];
  let openAt = -1;
  let opener = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (openAt === -1) {
      if (OPENERS.includes(char)) {
        openAt = index;
        opener = char;
      }
      continue;
    }

    if (index > openAt + 1 && (CLOSERS[opener] || []).includes(char)) {
      found.push(value.slice(openAt + 1, index).trim());
      openAt = -1;
      opener = '';
      continue;
    }

    if (OPENERS.includes(char) && char !== opener) {
      openAt = index;
      opener = char;
    }
  }

  return found;
}

// Line breaks, hashes, bold markers and over-long strings are parsing errors.
export function isParsingArtifact(quote) {
  const value = String(quote || '');
  if (value.length > QUOTE_MAX) return true;
  if (/[\n\r]/.test(value)) return true;
  if (value.includes('#')) return true;
  if (value.includes('**')) return true;
  return false;
}

// "the Eady Order", "the Application" and the like are defined terms, not quotations.
export function isDefinedTerm(quote) {
  const value = String(quote || '').replace(/[.,;:]+$/g, '').trim();
  if (!value) return false;
  const words = value.split(/\s+/);
  if (words.length === 0 || words.length > 6) return false;
  if (!/^(?:the|a|an|this|that|such)\s/i.test(value)) return false;
  if (/\b(?:is|are|was|were|shall|must|may|would|should|held|holds|said|says|observed|concluded|whether)\b/i.test(value)) {
    return false;
  }
  return words.every((word, index) =>
    index === 0
      ? /^(?:the|a|an|this|that|such)$/i.test(word)
      : /^(?:of|the|and|for|to|in|on|de|by|with|&)$/i.test(word) || /^[A-Z]/.test(word)
  );
}

export function isCaseName(quote) {
  const value = String(quote || '').trim();
  if (!value || /[.;:]/.test(value)) return false;
  return value.split(/\s+/).length <= 8 && CASE_NAME.test(value);
}

// Attributed to a case: a case name, a neutral citation, or "the Court of Appeal held".
export function hasAttribution(value) {
  const text = String(value || '');
  if (CASE_NAME.test(text)) return true;
  if (NEUTRAL_CITE.test(text)) return true;
  if (/\bper\s+[A-Z][a-z]/.test(text)) return true;
  return SPEAKING_VERB.test(text) && COURT_WORD.test(text);
}

function authoritySections(text) {
  const source = String(text || '');
  const found = [];
  let match;
  HEADING_LINE.lastIndex = 0;
  while ((match = HEADING_LINE.exec(source)) !== null) {
    const title = String(match[1] || match[2] || '').trim();
    if (!title) continue;
    found.push({ index: match.index, authority: AUTHORITY_SECTION.test(title) });
  }
  return found;
}

function inAuthoritySection(list, index) {
  let current = null;
  list.forEach((entry) => {
    if (entry.index <= index) current = entry;
  });
  return Boolean(current?.authority);
}

function candidate(quote) {
  if (!quote || quote.length < MIN_QUOTE) return false;
  if (isParsingArtifact(quote)) return false;
  return !isDefinedTerm(quote) && !isCaseName(quote);
}

export function findQuotations(text) {
  const found = [];
  const seen = new Set();

  splitSentences(text).forEach((span) => {
    quotesInSentence(span.text).forEach((quote) => {
      if (!candidate(quote)) return;
      const key = normalise(quote);
      if (!key || seen.has(key)) return;
      seen.add(key);
      found.push(quote);
    });
  });

  return found;
}

// Quotations in scope for the authority check: attributed to a case, or inside
// an Authorities / Legal Framework section. Everything else is not checked.
export function findAuthorityQuotations(text, extracts = []) {
  const source = String(text || '');
  const spans = splitSentences(source);
  const heads = authoritySections(source);
  const pool = (extracts || []).map((extract) => ({ ...extract, norm: normalise(extract.extract_text) }));
  const rows = [];
  const seen = new Set();

  spans.forEach((span, index) => {
    const previous = spans[index - 1];
    const next = spans[index + 1];
    const context = [previous?.text, span.text, next?.text]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    quotesInSentence(span.text).forEach((raw) => {
      const quote = raw.trim();
      if (!candidate(quote)) return;
      const key = normalise(quote);
      if (!key || seen.has(key)) return;

      const attributed = hasAttribution(context);
      const sectioned = inAuthoritySection(heads, span.start);
      if (!attributed && !sectioned) return;

      seen.add(key);
      const hit = pool.find((entry) => entry.norm === key) || pool.find((entry) => entry.norm.includes(key));

      rows.push({
        quote,
        key,
        context: span.text.trim(),
        matched: Boolean(hit),
        paragraph_ref: hit ? hit.paragraph_ref : '',
        case_law_id: hit ? hit.case_law_id : '',
        attribution: attributed ? 'case' : 'section',
      });
    });
  });

  return rows;
}

export function checkQuotations(text, extracts) {
  return findQuotations(text).map((quote) => {
    const norm = normalise(quote);
    const hit =
      (extracts || []).find((entry) => normalise(entry.extract_text) === norm) ||
      (extracts || []).find((entry) => normalise(entry.extract_text).includes(norm));
    return {
      quote,
      matched: Boolean(hit),
      paragraph_ref: hit ? hit.paragraph_ref : '',
      case_law_id: hit ? hit.case_law_id : '',
    };
  });
}

function numbersIn(value) {
  return (String(value || '').match(/\d{1,3}/g) || []).map(Number);
}

const PARA_RE = /\b(?:paras?|paragraphs?)\.?\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?|\b\[(\d{1,3})\]/gi;

export function checkParagraphRefs(text, extracts) {
  const stored = new Set();
  (extracts || []).forEach((extract) => {
    numbersIn(extract.paragraph_ref).forEach((number) => stored.add(number));
  });

  const results = [];
  const seen = new Set();
  let match;
  PARA_RE.lastIndex = 0;
  while ((match = PARA_RE.exec(String(text || ''))) !== null) {
    const label = match[0].trim();
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());

    const numbers = match[3]
      ? [Number(match[3])]
      : [Number(match[1]), match[2] ? Number(match[2]) : Number(match[1])];
    const missing = [...new Set(numbers)].filter((number) => !stored.has(number));

    results.push({ reference: label, matched: missing.length === 0, missing });
  }
  return results;
}