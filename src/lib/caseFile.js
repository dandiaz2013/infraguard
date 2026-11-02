// Case File Library helpers. Deterministic only: no AI, no guessing.
// The case file is the record. Generated drafts are not.
import { normalise } from '@/lib/authorityCheck';

export const CASE_FILE_CATEGORIES = [
  'Judgments',
  'Orders',
  'Witness statements',
  'Exhibits',
  'Application notices',
  'Transcripts',
  'Skeleton arguments',
  'Correspondence',
  'Contracts',
  'Other',
];

export const PARTY_OPTIONS = ['Ours', 'Other side', 'Court'];
export const RECORD_STATUSES = ['Filed or served', 'Draft', 'Reference only'];

export const PARTY_TO_FILED_BY = {
  Ours: 'Ours',
  'Other side': 'Other party',
  Court: 'Court',
};

// Shape the record engine (buildRecord / indexDocument) expects.
export function toRecordDoc(document = {}) {
  return {
    id: document.id,
    name: document.file_name || document.name || 'Document',
    text: document.text || '',
    category: document.category || '',
    party: document.party || '',
    record_status: document.record_status || 'Filed or served',
    filed_by: PARTY_TO_FILED_BY[document.party] || document.filed_by || '',
    filed_date: document.document_date || document.filed_date || '',
    exhibit_of: document.exhibit_of || '',
  };
}

function defaultReason(document) {
  const party = document.party || '';
  switch (document.category) {
    case 'Judgments':
      return 'The judgment being challenged';
    case 'Orders':
      return 'The order being challenged';
    case 'Witness statements':
      if (party === 'Ours') return 'Our witness statement';
      if (party === 'Other side') return "The other side's witness statement";
      return 'A witness statement in the case file';
    case 'Application notices':
      return 'The application notice and continuation sheet';
    case 'Transcripts':
      return 'The transcript of the hearing';
    default:
      return '';
  }
}

// Default ticks for the Document Generator source panel, each with its reason.
export function defaultSourceSelection(documents = []) {
  return documents
    .filter((document) => (document.record_status || 'Filed or served') !== 'Reference only')
    .map((document) => ({ id: document.id, reason: defaultReason(document) }))
    .filter((row) => row.reason);
}

// Mapping used when moving uploads that were made elsewhere in the app.
export function legacyCategory(fileName = '', category = '') {
  if (category === 'Our witness statement' || category === 'Other party witness statement') {
    return 'Witness statements';
  }
  if (category === 'N244 and continuation sheet') return 'Application notices';
  if (category === 'Previous judgments and orders') {
    return /order/i.test(fileName) && !/judg/i.test(fileName) ? 'Orders' : 'Judgments';
  }
  return 'Other';
}

export function legacyParty(file = {}) {
  const filedBy = file.filed_by || '';
  if (filedBy === 'Ours') return 'Ours';
  if (filedBy === 'Other party') return 'Other side';
  if (filedBy === 'Court') return 'Court';
  if (file.category === 'Our witness statement' || file.category === 'N244 and continuation sheet') return 'Ours';
  if (file.category === 'Other party witness statement') return 'Other side';
  if (file.category === 'Previous judgments and orders') return 'Court';
  return 'Ours';
}

function nameMatches(documentName, citedName) {
  const left = normalise(documentName).replace(/\.[a-z0-9]{2,5}$/, '');
  const right = normalise(citedName);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

const PARAGRAPH_CITE =
  /\b([A-Z][A-Za-z0-9&.'’()/-]*(?:\s+[A-Za-z0-9&.'’()/-]+){0,6})\s*,?\s+(?:at\s+)?para(?:graph)?s?\s+(\d{1,3})/g;
const QUOTE = /"([^"]{25,600})"/g;

// Checks every paragraph reference and every quoted passage in a draft against
// the case file documents the user ticked. Deterministic, verified in code.
export function verifyDraftCitations(text, record = {}) {
  const source = String(text || '');
  const documents = record.documents || [];
  const rows = [];
  const seen = new Set();

  const push = (row) => {
    const key = `${row.kind}:${row.cited}:${row.ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  PARAGRAPH_CITE.lastIndex = 0;
  let match;
  while ((match = PARAGRAPH_CITE.exec(source)) !== null) {
    const cited = match[1].replace(/\s+/g, ' ').trim();
    const ref = `para ${Number(match[2])}`;
    const document = documents.find((item) => nameMatches(item.name, cited));
    const segment = document?.segments?.find((item) => item.ref === ref);
    push({
      kind: 'paragraph',
      cited: `${cited}, ${ref}`,
      document_name: document?.name || '',
      ref,
      verified: Boolean(segment),
      status: !document
        ? 'Not in the case file documents chosen for this draft'
        : segment
          ? 'Paragraph found in the chosen document'
          : 'Paragraph not found in the chosen document',
    });
  }

  QUOTE.lastIndex = 0;
  let quoted;
  while ((quoted = QUOTE.exec(source)) !== null) {
    const value = quoted[1].replace(/\s+/g, ' ').trim();
    const document = documents.find((item) => normalise(item.text || '').includes(normalise(value)));
    push({
      kind: 'quote',
      cited: value,
      document_name: document?.name || '',
      ref: '',
      verified: Boolean(document),
      status: document
        ? `Exact text found in ${document.name}`
        : 'This quotation is not in the case file documents chosen for this draft',
    });
  }

  return rows;
}