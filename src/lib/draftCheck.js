// Checks run in code on a finished draft: references, quotations, and whether the relief
// asked for is consistent with the order challenged. Nothing here calls a model.
import { clip } from '@/lib/recordIndex';
import { resolveDocumentRefs, checkDocumentQuotes } from '@/lib/docReferences';

const MAINTAIN =
  /\b(?:maintain|maintains|maintaining|maintained|uphold|upholds|upholding|upheld|affirm|affirms|affirming|restore|restores|restoring|reinstate|reinstates|reinstating|confirm|confirms|confirming)\b\s+(?:the|this|said|original|earlier|its)\s+(?:\w+\s+){0,3}(?:order|decision|judgment|judgement|ruling)\b/i;
const MAINTAIN_THING =
  /\b(?:maintain|maintains|maintaining|uphold|upholds|upholding|restore|restores|restoring|reinstate|reinstates|reinstating)\b\s+(?:the|this|said)\s+(?:\w+\s+){0,4}(?:scheme|arrangement|award|finding|stay|injunction|indemnity|provision)\b/i;
const STAND = /\b(?:order|decision|judgment|judgement|ruling)\b\s+(?:should|must|is to)\s+stand\b/i;
const SET_ASIDE = /\b(?:set aside|setaside|varied?|vary|variation|revoke[ds]?|revocation|reopened?|reopening)\b/i;
const MARKER = /\[(?:FACT NEEDED|NO EXTRACT|DOCUMENT REFERENCE NEEDED)[^\]]*\]/g;
const USER_STATEMENT = /\[USER STATEMENT - NO DOCUMENT REFERENCE\]/;

// References in the {{DOC}} form, checked against the paragraphs of the ticked documents.
export function referenceRows(text, documents = []) {
  return resolveDocumentRefs(text, documents).map((row) => ({
    kind: 'paragraph',
    cited: row.label,
    document_name: row.document_name,
    ref: row.reference,
    verified: row.status === 'found',
    status: `${row.statusLabel}${row.detail ? ` - ${row.detail}` : ''}`,
  }));
}

// A quotation is accepted from the ticked documents or from a stored, checked extract.
export function quoteRows(text, documents = [], extracts = []) {
  return checkDocumentQuotes(text, documents, extracts).map((row) => ({
    kind: 'quote',
    cited: row.quote,
    document_name: row.document_name,
    ref: row.reference,
    verified: row.status !== 'mismatch',
    status:
      row.status === 'authority'
        ? 'Found in a stored, checked extract'
        : row.status === 'match'
          ? `Exact text found in ${row.document_name}, ${row.reference}`
          : 'Not in the ticked documents and not in a stored extract',
  }));
}

export function checkRows(text, documents = [], extracts = []) {
  return [...referenceRows(text, documents), ...quoteRows(text, documents, extracts)];
}

// The relief must ask for the order challenged to be varied or set aside; it must never ask
// the court to maintain what that order set aside.
export function reliefConflicts(text, { variation = false, order = null } = {}) {
  if (!variation) return [];
  const source = String(text || '');
  const hits = [];

  source.split(/\n\s*\n/).forEach((block) => {
    const clean = block.trim();
    if (!clean) return;
    const maintains = MAINTAIN.test(clean) || MAINTAIN_THING.test(clean) || STAND.test(clean);
    if (!maintains) return;
    if (SET_ASIDE.test(clean)) return;
    hits.push({
      kind: 'conflict',
      passage: clip(clean, 320),
      problem:
        'This asks the court to maintain a decision or an outcome. The application is to vary or revoke the order challenged, so the court is never asked to maintain what that order set aside.',
      fix: order?.name
        ? `Ask instead for ${order.name}${order.date_text ? ` (${order.date_text})` : ''} to be varied or set aside, in the words of the application notice.`
        : 'Ask instead for the order challenged to be varied or set aside, in the words of the application notice.',
      section: 'The relief sought',
    });
  });

  if (!SET_ASIDE.test(source)) {
    hits.push({
      kind: 'conflict',
      passage: clip(source.split(/\n\s*\n/).slice(-2).join(' '), 320),
      problem: 'The draft does not ask for the order challenged to be varied or set aside anywhere.',
      fix: 'State the primary relief (vary or set aside) and the alternative relief, each tied to the application notice.',
      section: 'The relief sought',
    });
  }

  return hits;
}

// Counsel's review: the passages that ask for the wrong relief, statements with no
// reference, quotations that are not in the record, and the open markers.
export function reviewItems(text, documents = [], extracts = [], { variation = false, order = null } = {}) {
  const source = String(text || '');
  const items = [...reliefConflicts(source, { variation, order })];

  quoteRows(source, documents, extracts)
    .filter((row) => !row.verified)
    .slice(0, 5)
    .forEach((row) => {
      items.push({
        kind: 'weak',
        passage: row.cited,
        problem: 'This quotation is not in the ticked documents and not in a stored, checked extract.',
        fix: 'Quote the exact words from the ticked document, or delete the quotation.',
        section: 'A quotation',
      });
    });

  source.split(/\n\s*\n/).forEach((block) => {
    const clean = block.trim();
    if (clean.length < 90) return;
    if (clean.startsWith('#') || clean.startsWith('|')) return;
    if (clean.includes('{{DOC:')) return;
    if (USER_STATEMENT.test(clean)) return;
    MARKER.lastIndex = 0;
    if (MARKER.test(clean)) return;
    if (!(/\b(?:1[89]\d{2}|20\d{2})\b/.test(clean) || /\b(?:order|judgment|hearing|served|filed)\b/i.test(clean))) return;
    items.push({
      kind: 'unreferenced',
      passage: clip(clean, 320),
      problem: 'A statement of fact with no {{DOC}} reference.',
      fix: 'Add the document id and paragraph: {{DOC:<document id>|para N}}.',
      section: 'A statement of fact',
    });
  });

  MARKER.lastIndex = 0;
  let marker;
  const seen = new Set();
  while ((marker = MARKER.exec(source)) !== null) {
    if (seen.has(marker[0])) continue;
    seen.add(marker[0]);
    items.push({
      kind: 'marker',
      passage: marker[0],
      problem: 'An open marker: the material behind it has not been supplied.',
      fix: 'Supply the fact, the extract or the document reference, then draft the passage again.',
      section: 'An open marker',
    });
  }

  return items.slice(0, 14);
}