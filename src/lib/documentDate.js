// Document dates read from the document itself. Deterministic, no guessing.
// An application notice and a witness statement are dated by their issue stamp,
// statement of truth or signature line - never by the first date in the body.
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

const LONG = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(MONTHS).join('|')})\\s+(\\d{4})\\b`,
  'gi'
);
const NUMERIC = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g;

const LONG_SRC = `\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${Object.keys(MONTHS).join('|')})\\s+\\d{4}`;
const NUMERIC_SRC = '\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}';
const DATE_SRC = `(${LONG_SRC}|${NUMERIC_SRC})`;

// Documents whose date comes from a stamp, statement of truth or signature line.
export const STAMPED_CATEGORIES = ['Application notices', 'Witness statements'];

function iso(year, month, day) {
  const pad = (value) => String(value).padStart(2, '0');
  const candidate = `${year}-${pad(month)}-${pad(day)}`;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  if (parsed.getUTCMonth() + 1 !== Number(month) || parsed.getUTCDate() !== Number(day)) return '';
  return candidate;
}

export function toIsoDate(raw = '') {
  const text = String(raw).trim();
  LONG.lastIndex = 0;
  const long = LONG.exec(text);
  if (long) return iso(Number(long[3]), MONTHS[long[2].toLowerCase()], Number(long[1]));
  NUMERIC.lastIndex = 0;
  const numeric = NUMERIC.exec(text);
  if (numeric) return iso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  return '';
}

export function formatDate(isoDate = '') {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function firstDateIn(text) {
  LONG.lastIndex = 0;
  const long = LONG.exec(text);
  NUMERIC.lastIndex = 0;
  const numeric = NUMERIC.exec(text);
  const candidates = [long, numeric].filter(Boolean).sort((a, b) => a.index - b.index);
  const hit = candidates[0];
  if (!hit) return '';
  if (hit === long) return iso(Number(long[3]), MONTHS[long[2].toLowerCase()], Number(long[1]));
  return iso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
}

function dateMatch(pattern, text) {
  const match = String(text || '').match(pattern);
  if (!match) return '';
  return toIsoDate(match[1] || match[0]);
}

// "Issued on 19 August 2026", "Date of issue: 19/08/2026", "Sealed ...".
function issueStampDate(text) {
  const body = String(text || '');
  return (
    dateMatch(
      new RegExp(
        `\\b(?:issued(?:\\s+on)?|date of issue|issue date|sealed(?:\\s+on)?|stamped(?:\\s+on)?|filed(?:\\s+on)?)\\b[^\\n]{0,40}?${DATE_SRC}`,
        'i'
      ),
      body
    ) ||
    dateMatch(
      new RegExp(
        `\\b(?:N244|application notice|continuation sheet)\\b[^\\n]{0,100}?\\b(?:issued|sealed|stamped)\\b[^\\n]{0,24}?${DATE_SRC}`,
        'i'
      ),
      body
    )
  );
}

function statementOfTruthDate(text) {
  const body = String(text || '');
  const at = body.search(/\bstatement of truth\b/i);
  if (at < 0) return '';
  const tail = body.slice(at, at + 1600);
  return (
    dateMatch(new RegExp(`\\bdated\\s*:?\\s*${DATE_SRC}`, 'i'), tail) ||
    dateMatch(new RegExp(DATE_SRC, 'i'), tail)
  );
}

// Only a signature or date line counts, never a date mentioned in the body.
function signatureDate(text) {
  const tail = String(text || '').slice(-2500);
  return (
    dateMatch(new RegExp(`(?:^|\\n)\\s*(?:signed|signature)\\b[^\\n]{0,60}?${DATE_SRC}`, 'i'), tail) ||
    dateMatch(new RegExp(`(?:^|\\n)\\s*dated\\s*:?\\s*${DATE_SRC}`, 'i'), tail)
  );
}

// The heading lines an order or a judgment is dated by. A date inside a later
// sentence ("the order of Master Brown dated 25th March 2024") is a reference to
// another document and is never used.
const HEADING_START = '^[ \\t*_#]{0,10}(?:\\d{1,2}[.)][ \\t*]{0,4})?';
const HEADING_WORDS = {
  Orders: [
    'dated',
    'date\\s*:',
    'date of order',
    'order\\s+(?:dated|made on)',
    'order made on',
    'made on',
    'sitting on',
    'handed down',
    'before'
  ],
  Judgments: [
    'dated',
    'date\\s*:',
    'date of judgment',
    'judgment date',
    'judgment\\s+dated',
    'handed down',
    'delivered',
    'given\\s+on',
    'approved',
    'sitting on',
    'before'
  ]
};

function headingDate(text, keywords) {
  const lines = String(text || '').split('\n');
  const head = lines.slice(0, 24);
  const foot = lines.slice(Math.max(24, lines.length - 20));
  const pattern = new RegExp(`${HEADING_START}(?:${keywords.join('|')})(?![a-z])`, 'i');
  for (const line of [...head, ...foot]) {
    if (!line.trim()) continue;
    if (!pattern.test(line)) continue;
    const value = toIsoDate(line);
    if (value) return value;
  }
  return '';
}

// Returns the date and where it was read from, so the user can confirm or change it.
export function detectDocumentDate(text = '', category = '') {
  const body = String(text || '');
  if (!body.trim()) return { date: '', source: 'no text' };
  const head = body.slice(0, 4000);

  if (STAMPED_CATEGORIES.includes(category)) {
    const stamp = issueStampDate(head) || issueStampDate(body);
    if (stamp) return { date: stamp, source: 'issue stamp' };
    const truth = statementOfTruthDate(body);
    if (truth) return { date: truth, source: 'statement of truth' };
    const signed = signatureDate(body);
    if (signed) return { date: signed, source: 'signature line' };
    return { date: '', source: 'no date on the stamp, statement of truth or signature' };
  }

  // A judgment or an order is dated by the heading lines above only - never by a
  // date in the body, and never by its reference to another order.
  if (category === 'Judgments' || category === 'Orders') {
    const heading = headingDate(body, HEADING_WORDS[category]);
    if (heading) {
      return { date: heading, source: category === 'Judgments' ? 'judgment date' : 'order date' };
    }
  }

  const anchors = [];
  if (category === 'Correspondence') {
    anchors.push([/^\s*(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/m, 'letter date']);
    anchors.push([/(?:^|\n)\s*date:\s*([^\n]{4,30})/i, 'letter date']);
  }
  if (category === 'Transcripts') {
    anchors.push([
      /(?:hearing|proceedings|before)[^\n.]{0,80}?(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/i,
      'hearing date'
    ]);
  }

  for (const [pattern, source] of anchors) {
    const match = head.match(pattern);
    if (match) {
      const value = toIsoDate(match[1]);
      if (value) return { date: value, source };
    }
  }

  // A judgment or an order is never dated from a later reference to another one.
  if (category === 'Judgments' || category === 'Orders') {
    return { date: '', source: 'no date on the heading or the date line' };
  }

  const fallback = firstDateIn(head);
  return fallback
    ? { date: fallback, source: 'first date in the document' }
    : { date: '', source: 'no date found' };
}

export function dateFromDocument(text = '', category = '') {
  return detectDocumentDate(text, category).date;
}

// The line shown beside a detected date: it is never treated as confirmed on its own.
export function detectedLabel(detection = {}) {
  if (!detection.date) return 'Date not found - enter it';
  const shown = formatDate(detection.date);
  if (detection.source && detection.source !== 'first date in the document') {
    return `Detected: ${shown} (${detection.source}) - Confirm / Change`;
  }
  return `Detected: ${shown} - Confirm / Change`;
}

// Only a confirmed date is used by promptness. Documents saved before dates were
// confirmed still use the date that was entered against them.
export function confirmedDate(document = {}) {
  if (document.date_confirmed === true) return document.confirmed_date || '';
  if (document.date_confirmed === false) return '';
  return document.confirmed_date || document.document_date || document.filed_date || document.doc_date || '';
}

export function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
}

export function intervalText(days) {
  if (days === null || days === undefined) return '';
  const months = Math.round((days / 30.44) * 10) / 10;
  return `${days} day${days === 1 ? '' : 's'} (about ${months} month${months === 1 ? '' : 's'})`;
}