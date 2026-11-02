// Attribution check. If a quotation appears in a different document from the one the
// draft cites, the draft gets [WRONG SOURCE: found in X, cited as Y] and a one-click fix.
import { normalise } from '@/lib/authorityCheck';

const QUOTE = /[“"]([^”"]{25,400})[”"]/g;
const DOC_MARKER = /\{\{DOC:([^|}]+)/;
const REF_NEAR = /\b(para|paragraph|p\.|page|lines?)\s*[:\s]?\s*(\d{1,3}[a-z]?(?:\s*[-–]\s*\d{1,3})?)/i;

function findQuote(record, quote) {
  const needle = normalise(quote).slice(0, 140);
  if (!needle) return null;
  const segments = record?.segments || [];
  for (const segment of segments) {
    if ((segment.norm || '').includes(needle)) {
      return {
        document_id: segment.document_id,
        document_name: segment.document_name,
        ref: segment.ref,
        quote,
      };
    }
  }
  return null;
}

function citedDocument(context, documents) {
  const marker = context.match(DOC_MARKER);
  if (marker) {
    const id = marker[1].trim();
    const doc = documents.find((entry) => String(entry.id) === id);
    return { id, name: doc?.name || id, marker: true };
  }
  const norm = normalise(context);
  const doc = documents.find((entry) => {
    const name = normalise(String(entry.name).replace(/\.[a-z0-9]{2,5}$/i, '')).replace(/\s+/g, ' ').trim();
    return name.length > 7 && norm.includes(name);
  });
  return doc ? { id: doc.id, name: doc.name, marker: false } : null;
}

export function checkQuoteSources(text, record) {
  const source = String(text || '');
  const documents = record?.documents || [];
  if (!source || documents.length < 2) return [];

  const issues = [];
  const seen = new Set();
  let match;
  QUOTE.lastIndex = 0;
  while ((match = QUOTE.exec(source)) !== null) {
    const quote = match[1].trim();
    const context = source.slice(Math.max(0, match.index - 220), match.index + match[0].length + 120);
    const found = findQuote(record, quote);
    if (!found) continue;
    const cited = citedDocument(context, documents);
    if (!cited) continue;
    if (String(cited.id) === String(found.document_id) || normalise(cited.name) === normalise(found.document_name)) continue;

    const key = `${normalise(quote).slice(0, 60)}:${cited.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ref = context.match(REF_NEAR);
    const marker = context.match(DOC_MARKER);
    const markerText = marker
      ? source.slice(match.index - 220 + marker.index, match.index - 220 + marker.index + marker[0].length)
      : '';
    const replacement = marker ? markerText.replace(cited.id, found.document_id) : found.document_name;

    issues.push({
      id: `cite-${seen.size}`,
      quote,
      cited_name: cited.name,
      found_name: found.document_name,
      found_ref: found.ref,
      cited_ref: ref ? `${ref[1]} ${ref[2]}` : '',
      marker: `[WRONG SOURCE: found in ${found.document_name}, cited as ${cited.name}]`,
      fix: {
        find: marker ? markerText : cited.name,
        replace: replacement,
        label: `Correct the citation to ${found.document_name}`,
      },
    });
  }
  return issues.slice(0, 8);
}