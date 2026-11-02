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

const QUOTE_RE = /[“"]([^“”"]{12,600})[”"]/g;

export function findQuotations(text) {
  const found = [];
  const seen = new Set();
  let match;
  QUOTE_RE.lastIndex = 0;
  while ((match = QUOTE_RE.exec(String(text || ''))) !== null) {
    const quote = match[1].trim();
    const key = normalise(quote);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push(quote);
  }
  return found;
}

export function checkQuotations(text, extracts) {
  const pool = (extracts || []).map((extract) => ({ ...extract, norm: normalise(extract.extract_text) }));

  return findQuotations(text).map((quote) => {
    const norm = normalise(quote);
    const exact = pool.find((entry) => entry.norm === norm) || pool.find((entry) => entry.norm.includes(norm));
    return {
      quote,
      matched: Boolean(exact),
      paragraph_ref: exact ? exact.paragraph_ref : '',
      case_law_id: exact ? exact.case_law_id : '',
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