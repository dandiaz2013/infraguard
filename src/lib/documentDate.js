// Document dates read from the document itself. Deterministic, no guessing.
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

const LONG = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(MONTHS).join('|')})\\s+(\\d{4})\\b`,
  'gi'
);
const NUMERIC = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g;

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

// Judgments and orders: the date handed down or made. Letters: the date on the letter.
export function dateFromDocument(text = '', category = '') {
  const body = String(text || '');
  if (!body.trim()) return '';
  const head = body.slice(0, 4000);

  const anchors = [];
  if (category === 'Judgments') {
    anchors.push(
      /(?:handed down|delivered|given|approved|judgment date|date of judgment)[^\n.]{0,120}?(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/i,
      /(?:handed down|delivered|approved)[^\n]{0,40}?(\b\d{1,2}\/\d{1,2}\/\d{4}\b)/i
    );
  }
  if (category === 'Orders') {
    anchors.push(/(?:DATED|dated|Date of order)[^\n.]{0,60}?(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/);
  }
  if (category === 'Judgments') {
    anchors.push(/(?:^|\n)\s*Date\s*:\s*([^\n]{6,30})/);
  }
  if (category === 'Application notices') {
    anchors.push(
      /(?:N244|application notice)[^\n]{0,80}?[Dd]ated\s*:?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-]\d{4}|[^\n]{6,30})/i,
      /[Dd]ated\s*:?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-]\d{4}|\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/i
    );
  }
  if (category === 'Witness statements') {
    // Only a date next to the heading or the signature: a date inside the evidence is a fact,
    // not the date of the statement.
    anchors.push(
      /(?:^|\n)\s*[^\n]{0,60}?(?:statement|dated)\s+(?:of\s+)?(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/i,
      /dated\s*:?\s*(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)\s*$/im
    );
  }
  if (category === 'Correspondence') {
    anchors.push(/^\s*(\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}\b)/m, /(?:^|\n)\s*date:\s*([^\n]{4,30})/i);
  }

  for (const pattern of anchors) {
    const match = head.match(pattern);
    if (match) {
      const value = toIsoDate(match[1]);
      if (value) return value;
    }
  }
  // A witness statement's date is never guessed from a date in the evidence.
  if (category === 'Witness statements') return '';
  return firstDateIn(head);
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