// Deterministic citation parser: regular expressions and string offsets only, no AI.
// Party names keep Ltd, plc and brackets; a pinpoint must sit in the same sentence as
// the case it follows; law report citations are recorded without an automatic link.

const DIVISION_WORDS = ['Ch', 'Comm', 'TCC', 'Admin', 'KB', 'QB', 'IPEC', 'Fam', 'Pat', 'Admlty', 'Costs'];
const DIVISION_SRC = `(?:\\s*\\(?(${DIVISION_WORDS.join('|')})\\)?)?`;

const CITATION_SOURCE = `\\[\\d{4}\\]\\s+(UKSC|UKHL|UKPC|EWCA\\s+Civ|EWCA\\s+Crim|EWHC)\\s+\\d+${DIVISION_SRC}`;

const LAW_REPORT_ABBREV = [
  'All ER', 'WLR', 'AC', 'QB', 'Ch', 'Fam', 'Cr App R', "Lloyd's Rep", 'BCLC',
  'P&CR', 'ICR', 'IRLR', 'FLR', 'STC', 'TC', 'Costs LR', 'Env LR', 'LGR'
];
const LAW_REPORT_SOURCE = `\\[\\d{4}\\]\\s+(?:\\d{1,3}\\s+)?(?:${LAW_REPORT_ABBREV.join('|')})\\s+\\d{1,5}`;

export const LAW_REPORT_STATUS = 'Law report citation, no automatic link';

const COURT_BY_CODE: Record<string, string> = {
  UKSC: 'Supreme Court',
  UKHL: 'House of Lords',
  UKPC: 'Privy Council',
  'EWCA Civ': 'Court of Appeal (Civil Division)',
  'EWCA Crim': 'Court of Appeal (Criminal Division)',
  EWHC: 'High Court',
};

const DIVISION_CODES: Record<string, string> = {
  ch: 'ch', comm: 'comm', tcc: 'tcc', admin: 'admin', kb: 'kb', qb: 'qb',
  ipec: 'ipec', fam: 'fam', pat: 'pat', admlty: 'admlty', costs: 'costs',
};

const STOP_OPENERS = [
  'The', 'This', 'That', 'It', 'In', 'As', 'If', 'Where', 'When', 'See', 'Also',
  'Cf', 'But', 'And', 'However', 'Following', 'Per', 'Relying', 'Applying', 'Compare', 'Eg'
];
export const MAX_CANDIDATES = 300;

const WORD_RE = /^[A-Z][A-Za-z'’&.\-]*$/;
const CORP_RE = /^(?:Ltd|Limited|plc|PLC|LLP|Inc|Co|Group|Holdings|SA|NV|GmbH|Bros|&)$/;
const BRACKET_RE = /^\([A-Za-z&.'’\-]{1,12}\)$/;

function normaliseSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isStop(word: string): boolean {
  return STOP_OPENERS.some((entry) => entry.toLowerCase() === String(word).toLowerCase());
}

function isNameWord(word: string): boolean {
  return WORD_RE.test(word) || CORP_RE.test(word) || BRACKET_RE.test(word);
}

export function findCitations(text: string) {
  const pattern = new RegExp(CITATION_SOURCE, 'g');
  const found: { citation: string; index: number; end: number }[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const citation = normaliseSpace(match[0]);
    found.push({ citation, index: match.index, end: match.index + match[0].length });
  }
  return found;
}

export function findLawReportCitations(text: string) {
  const pattern = new RegExp(LAW_REPORT_SOURCE, 'g');
  const found: { citation: string; index: number; end: number }[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    found.push({ citation: normaliseSpace(match[0]), index: match.index, end: match.index + match[0].length });
  }
  return found;
}

export function courtFor(citation: string): string {
  const upper = citation.toUpperCase();
  if (upper.includes('UKSC')) return COURT_BY_CODE.UKSC;
  if (upper.includes('UKHL')) return COURT_BY_CODE.UKHL;
  if (upper.includes('UKPC')) return COURT_BY_CODE.UKPC;
  if (upper.includes('EWCA CIV')) return COURT_BY_CODE['EWCA Civ'];
  if (upper.includes('EWCA CRIM')) return COURT_BY_CODE['EWCA Crim'];
  if (upper.includes('EWHC')) return COURT_BY_CODE.EWHC;
  return '';
}

export function yearFor(citation: string): number | null {
  const match = citation.match(/\[(\d{4})\]/);
  return match ? Number(match[1]) : null;
}

// Builds a Find Case Law link only where the neutral citation maps to one exactly.
export function buildCaseLink(citation: string): string {
  if (!citation) return '';
  const text = normaliseSpace(citation).replace(/[.,;]+$/, '');
  const match = text.match(/^\[(\d{4})\]\s+(UKSC|UKHL|UKPC|EWCA\s+Civ|EWCA\s+Crim|EWHC)\s+(\d+)(?:\s*\(?([A-Za-z]+)\)?)?$/);
  if (!match) return '';

  const year = match[1];
  const code = normaliseSpace(match[2]).toUpperCase();
  const number = match[3];
  const division = (match[4] || '').toLowerCase();
  const base = 'https://caselaw.nationalarchives.gov.uk';

  if (code === 'UKSC') return `${base}/uksc/${year}/${number}`;
  if (code === 'UKHL') return `${base}/ukhl/${year}/${number}`;
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

function collectLeft(text: string, vStart: number): string[] {
  const before = text.slice(Math.max(0, vStart - 160), vStart);
  const words = before.split(/\s+/).filter(Boolean);
  const picked: string[] = [];
  for (let i = words.length - 1; i >= 0 && picked.length < 8; i -= 1) {
    if (!isNameWord(words[i])) break;
    picked.unshift(words[i]);
  }
  while (picked.length > 1 && isStop(picked[0])) picked.shift();
  if (picked.length === 0 || isStop(picked[0])) return [];
  return picked;
}

function collectRight(text: string, vEnd: number): string[] {
  const after = text.slice(vEnd, vEnd + 160);
  const words = after.split(/\s+/).filter(Boolean);
  const picked: string[] = [];
  for (const word of words) {
    if (picked.length >= 8) break;
    const clean = word.replace(/[,;:)"'”’]+$/, '');
    const kept = BRACKET_RE.test(clean) ? clean : clean.replace(/[.]+$/, '');
    if (!isNameWord(kept)) break;
    picked.push(kept);
  }
  while (picked.length > 0 && isStop(picked[0])) picked.shift();
  return picked;
}

function findCaseNames(text: string) {
  const results: { name: string; start: number; end: number }[] = [];
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

    results.push({ name: `${leftStr} v ${rightStr}`, start, end: rightAt + rightStr.length });
  }
  return results;
}

function isSentenceBreak(text: string, index: number): boolean {
  const ch = text[index];
  if (ch === '\n') return true;
  if (!'.!?;'.includes(ch)) return false;
  const after = text.slice(index + 1, index + 40);
  if (!/^\s+[A-Z(\[]/.test(after)) return false;
  const before = text.slice(Math.max(0, index - 8), index + 1);
  // "v.", "No.", "Ltd.", "Mr." do not end a sentence.
  if (/\b(?:v|vs|no|mr|mrs|ms|dr|hon|co|ltd|plc|st|jr|cf)\.$/i.test(before)) return false;
  return true;
}

function sentenceAround(text: string, index: number) {
  let start = 0;
  for (let i = index; i >= 0; i -= 1) {
    if (isSentenceBreak(text, i)) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = index; i < text.length; i += 1) {
    if (isSentenceBreak(text, i)) {
      end = i + 1;
      break;
    }
  }
  return { start, end };
}

// A pinpoint belongs to the case it follows, and only inside the same sentence.
function findParagraphRef(text: string, start: number, end: number): string {
  const bounds = sentenceAround(text, start);
  const after = text.slice(end, bounds.end);
  const before = text.slice(bounds.start, start);
  const pattern = /(?:at\s+|see\s+)?(?:para(?:graph)?s?\.?\s*(\d{1,3})(?:\s*\(([A-Za-z0-9]{1,4})\))?|\[(\d{1,3})\])/i;

  const hit = after.match(pattern) || before.match(pattern);
  if (!hit) return '';
  if (hit[3]) return `[${hit[3]}]`;
  return `para ${hit[1]}${hit[2] ? `(${hit[2].toLowerCase()})` : ''}`;
}

function excerptFor(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 150);
  const to = Math.min(text.length, end + 150);
  return normaliseSpace(text.slice(from, to));
}

function buildCandidate(
  text: string,
  name: string,
  citation: string,
  start: number,
  end: number,
  linkStatus = ''
) {
  return {
    name,
    neutral_citation: citation,
    court: citation ? courtFor(citation) : '',
    year: citation ? yearFor(citation) : null,
    paragraph_ref: findParagraphRef(text, start, end),
    excerpt: excerptFor(text, start, end),
    link_status: linkStatus,
    needs_name_confirmation: true,
  };
}

export function extractCandidates(text: string) {
  const citations = findCitations(text);
  const names = findCaseNames(text).sort((a, b) => a.start - b.start);

  const usedCitations = new Set<string>();
  const seenKeys = new Set<string>();
  const candidates: any[] = [];

  for (const entry of names) {
    // The citation must follow the name inside the same sentence.
    const bounds = sentenceAround(text, entry.start);
    const linked = citations.find(
      (citation) =>
        citation.index >= entry.end &&
        citation.index <= bounds.end &&
        !usedCitations.has(citation.citation.toLowerCase())
    );

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

  // Law reports: the case is added, but there is no automatic link.
  for (const report of findLawReportCitations(text)) {
    const key = `l:${report.citation.toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const bounds = sentenceAround(text, report.index);
    const named = names.find((entry) => entry.start >= bounds.start && entry.end <= bounds.end);
    candidates.push({
      ...buildCandidate(
        text,
        named ? named.name : `Unknown - ${report.citation}`,
        report.citation,
        report.index,
        report.end,
        LAW_REPORT_STATUS
      ),
      court: '',
      year: yearFor(report.citation),
      position: report.index,
    });
  }

  return candidates
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_CANDIDATES)
    .map(({ position, ...candidate }) => candidate);
}

// Every neutral citation appearing in a text, once each, in order of appearance.
export function uniqueCitations(text: string) {
  const seen = new Map<string, string>();
  for (const entry of findCitations(text)) {
    const key = entry.citation.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.citation);
  }
  return [...seen.values()];
}