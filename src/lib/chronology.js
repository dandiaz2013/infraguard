// Deterministic chronology. Every date in the record becomes a dated entry attributed to
// the document, the paragraph and the party who said it. No dates are invented.
import { ROLE_LABELS } from '@/lib/recordIndex';

const MONTHS = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

function isoDate(year, month, day) {
  const y = String(Number(year));
  const m = String(Number(month)).padStart(2, '0');
  const d = String(Number(day)).padStart(2, '0');
  const time = Date.parse(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  return { iso: `${y}-${m}-${d}`, time };
}

export function parseDate(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month) return isoDate(match[3], month, match[1]);
  }
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : match[3];
    return isoDate(year, match[2], match[1]);
  }
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return isoDate(match[1], match[2], match[3]);
  return null;
}

const ORDER_TERM = /\b(order|judgment|judgement|decision|dismissed|refused)\b/i;
const APPLICATION_TERM = /\b(application|appeal|permission|review|notice of appeal|N244|renewed)\b/i;
const PROMPTNESS_LIMIT_DAYS = 21;

export function buildChronology(record) {
  const entries = [];
  const seen = new Set();

  (record?.items || [])
    .filter((item) => item.kind === 'date')
    .forEach((item) => {
      const parsed = parseDate(item.label);
      if (!parsed) return;
      const key = `${parsed.iso}:${item.document_name}:${item.ref}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        date: parsed.iso,
        stated_as: item.label,
        time: parsed.time,
        who: item.role,
        who_label: ROLE_LABELS[item.role] || item.role || 'Party not recorded',
        document_name: item.document_name,
        ref: item.ref,
        quote: item.quote,
      });
    });

  entries.sort((a, b) => a.time - b.time || a.document_name.localeCompare(b.document_name));

  const intervals = [];
  for (let index = 1; index < entries.length; index += 1) {
    const days = Math.round((entries[index].time - entries[index - 1].time) / 86400000);
    if (days <= 0) continue;
    intervals.push({
      from: entries[index - 1].date,
      to: entries[index].date,
      days,
      note: `${days} day${days === 1 ? '' : 's'} between ${entries[index - 1].quote.slice(0, 60)} and ${entries[index].quote.slice(0, 60)}`,
    });
  }

  const orderEntry =
    entries.find((entry) => entry.who === 'Court' && ORDER_TERM.test(entry.quote)) ||
    entries.find((entry) => entry.who === 'Court');
  const applicationEntry = orderEntry
    ? entries.find((entry) => entry.time >= orderEntry.time && APPLICATION_TERM.test(entry.quote) && entry !== orderEntry) ||
      entries.find((entry) => APPLICATION_TERM.test(entry.quote) && entry !== orderEntry)
    : entries.find((entry) => APPLICATION_TERM.test(entry.quote));

  let delay = null;
  if (orderEntry && applicationEntry) {
    const days = Math.abs(Math.round((applicationEntry.time - orderEntry.time) / 86400000));
    delay = {
      order: orderEntry,
      application: applicationEntry,
      days,
      flagged: days > PROMPTNESS_LIMIT_DAYS,
      note: `${days} day${days === 1 ? '' : 's'} between the order challenged (${orderEntry.document_name}, ${orderEntry.ref}) and the application (${applicationEntry.document_name}, ${applicationEntry.ref})${
        days > PROMPTNESS_LIMIT_DAYS ? ` — longer than the ${PROMPTNESS_LIMIT_DAYS}-day promptness period, so delay must be addressed` : ''
      }`,
    };
  }

  const longest = intervals.slice().sort((a, b) => b.days - a.days)[0] || null;

  return {
    entries,
    intervals,
    delay,
    longest,
    text: chronologyText(entries),
  };
}

export function chronologyText(entries = []) {
  return entries
    .map(
      (entry) =>
        `- ${entry.stated_as || entry.date} — ${entry.quote} (${entry.document_name}, ${entry.ref}; stated by ${entry.who_label})`
    )
    .join('\n');
}