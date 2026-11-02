// Deterministic citation parser: regular expressions and string offsets only, no AI.

const CITATION_SOURCE = '\\[\\d{4}\\]\\s+(UKSC|UKPC|EWCA\\s+Civ|EWCA\\s+Crim|EWHC)\\s+\\d+(\\s+\\([A-Za-z]+\\))?';

const COURT_BY_CODE = {
  UKSC: 'Supreme Court',
  UKPC: 'Privy Council',
  'EWCA Civ': 'Court of Appeal (Civil Division)',
  'EWCA Crim': 'Court of Appeal (Criminal Division)',
  EWHC: 'High Court',
};

const DIVISION_CODES = {
  ch: 'ch',
  comm: 'comm',
  tcc: 'tcc',
  admin: 'admin',
  kb: 'kb',
  qb: 'qb',
  ipec: 'ipec',
  fam: 'fam',
  pat: 'pat',
  admlty: 'admlty',
  costs: 'costs',
};

const STOP_OPENERS = ['The', 'This', 'That', 'It', 'In', 'As', 'If', 'Where', 'When'];
export const MAX_CANDIDATES = 300;

const WORD_RE = /^[A-Z][A-Za-z'’&.\-]*$/;

function normaliseSpace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function findCitations(text) {
  const pattern = new RegExp(CITATION_SOURCE, 'g');
  const found = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const citation = normaliseSpace(match[0]);
    found.push({ citation, index: match.index, end: match.index + match[0].length });
  }
  return found;
}

export function courtFor(citation) {
  const upper = citation.toUpperCase();
  if (upper.includes('UKSC')) return COURT_BY_CODE.UKSC;
  if (upper.includes('UKPC')) return COURT_BY_CODE.UKPC;
  if (upper.includes('EWCA CIV')) return COURT_BY_CODE['EWCA Civ'];
  if (upper.includes('EWCA CRIM')) return COURT_BY_CODE['EWCA Crim'];
  if (upper.includes('EWHC')) return COURT_BY_CODE.EWHC;
  return '';
}

export function yearFor(citation) {
  const match = citation.match(/\[(\d{4})\]/);
  return match ? Number(match[1]) : null;
}

// Builds a Find Case Law link only where the neutral citation maps to one exactly.
export function buildCaseLink(citation) {
  if (!citation) return '';
  const text = normaliseSpace(citation);
  const match = text.match(/^\[(\d{4})\]\s+(UKSC|UKPC|EWCA\s+Civ|EWCA\s+Crim|EWHC)\s+(\d+)(?:\s*\(([A-Za-z]+)\))?$/i);
  if (!match) return '';

  const year = match[1];
  const code = normaliseSpace(match[2]).toUpperCase();
  const number = match[3];
  const division = (match[4] || '').toLowerCase();
  const base = 'https://caselaw.nationalarchives.gov.uk';

  if (code === 'UKSC') return `${base}/uksc/${year}/${number}`;
  if (code === 'UKPC') return `${base}/ukpc/${year}/${number}`;
  if (code === 'EWCA CIV') return `${base}/ewca/civ/${year}/${number}`;
  if (code === 'EWCA CRIM') return `${base}/ewca/crim/${year}/${number}`;
  if (code === 'EWHC') {
    const path = DIVISION_CODES[division] || '';
    if (!path) return '';
    return `${base}/ewhc/${path}/${year}/${number}`;
  }
  return '';
}

function collectLeft(text, vStart) {
  const before = text.slice(Math.max(0, vStart - 120), vStart);
  const words = before.split(/\s+/).filter(Boolean);
  const picked = [];
  for (let i = words.length - 1; i >= 0 && picked.length < 6; i -= 1) {
    if (!WORD_RE.test(words[i])) break;
    picked.unshift(words[i]);
  }
  while (picked.length > 1 && STOP_OPENERS.includes(picked[0])) picked.shift();
  if (picked.length === 0 || STOP_OPENERS.includes(picked[0])) return [];
  return picked;
}

function collectRight(text, vEnd) {
  const after = text.slice(vEnd, vEnd + 120);
  const words = after.split(/\s+/).filter(Boolean);
  const picked = [];
  for (const word of words) {
    if (picked.length >= 6) break;
    const clean = word.replace(/[,.;:)\]"'”’]+$/, '');
    if (!WORD_RE.test(clean)) break;
    picked.push(clean);
  }
  return picked;
}

function findCaseNames(text) {
  const results = [];
  const separator = /(^|[^A-Za-z])v\.?([^A-Za-z]|$)/g;
  let match;
  while ((match = separator.exec(text)) !== null) {
    const lead = match[1] || '';
    const vStart = match.index + lead.length;
    const hasDot = text.charAt(vStart + 1) === '.';
    const vEnd = vStart + (hasDot ? 2 : 1);

    const leftWords = collectLeft(text, vStart);
    const rightWords = collectRight(text, vEnd);
    if (leftWords.length === 0 || rightWords.length === 0) continue;

    const leftStr = leftWords.join(' ');
    const rightStr = rightWords.join(' ');
    const start = text.lastIndexOf(leftStr, vStart);
    const rightAt = text.indexOf(rightStr, vEnd);
    if (start < 0 || rightAt < 0) continue;

    results.push({
      name: `${leftStr} v ${rightStr}`,
      start,
      end: rightAt + rightStr.length,
    });
  }
  return results;
}

function findParagraphRef(text, start, end) {
  const windowStart = Math.max(0, start - 150);
  const windowEnd = Math.min(text.length, end + 150);
  const windowText = text.slice(windowStart, windowEnd);
  const para = windowText.match(/(?:paragraph|para)\.?\s*(\d{1,3}[A-Za-z\-]*)/i);
  if (para) return `para ${para[1]}`;
  const bracket = windowText.match(/\[(\d{1,3})\]/);
  if (bracket) return `[${bracket[1]}]`;
  return '';
}

function excerptFor(text, start, end) {
  const from = Math.max(0, start - 150);
  const to = Math.min(text.length, end + 150);
  return normaliseSpace(text.slice(from, to));
}

function buildCandidate(text, name, citation, start, end) {
  return {
    name,
    neutral_citation: citation,
    court: citation ? courtFor(citation) : '',
    year: citation ? yearFor(citation) : null,
    paragraph_ref: findParagraphRef(text, start, end),
    excerpt: excerptFor(text, start, end),
  };
}

export function extractCandidates(text) {
  const citations = findCitations(text);
  const names = findCaseNames(text).sort((a, b) => a.start - b.start);

  const usedCitations = new Set();
  const seenKeys = new Set();
  const candidates = [];

  for (const entry of names) {
    const linked = citations.find(
      (citation) =>
        citation.index >= entry.end &&
        citation.index - entry.end <= 80 &&
        !usedCitations.has(citation.citation.toLowerCase())
    );
    if (linked && usedCitations.has(linked.citation.toLowerCase())) continue;

    const citation = linked ? linked.citation : '';
    const key = citation ? `c:${citation.toLowerCase()}` : `n:${entry.name.toLowerCase()}`;
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    if (citation) usedCitations.add(citation.toLowerCase());
    candidates.push({
      ...buildCandidate(text, entry.name, citation, entry.start, entry.end),
      position: entry.start,
    });
  }

  for (const citation of citations) {
    const lower = citation.citation.toLowerCase();
    if (usedCitations.has(lower)) continue;
    usedCitations.add(lower);
    const key = `c:${lower}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    candidates.push({
      ...buildCandidate(text, `Unknown - ${citation.citation}`, citation.citation, citation.index, citation.end),
      position: citation.index,
    });
  }

  return candidates
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_CANDIDATES)
    .map(({ position, ...candidate }) => candidate);
}

// Every neutral citation appearing in a text, once each, in order of appearance.
export function uniqueCitations(text) {
  const seen = new Map();
  for (const entry of findCitations(text)) {
    const key = entry.citation.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.citation);
  }
  return [...seen.values()];
}