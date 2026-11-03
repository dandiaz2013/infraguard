// The pack sent to the model for a draft: the paragraphs of the ticked documents that
// are relevant, the argument work, and the labels for each document.
// Deterministic only - the selection is by gateway issue, Our points and your pins.
import { clip } from '@/lib/recordIndex';
import { approachById } from '@/lib/issueApproach';

export const SKELETON_STRUCTURE = [
  '1. Introduction and relief sought',
  '2. Background and the order challenged - the procedural history in order, including any appeals and refusals',
  '3. The test - from the stored extracts only',
  '4. The seven gateway issues, in order, each with our answer, their answer and a conclusion',
  '5. Delay - the dates and the explanation',
  '6. Anticipated objections, including any other route the other side raises (for example CPR 52.30) and finality',
  '7. Relief - primary and alternative',
  '8. Documents and authorities list',
];

export function skeletonStructure({ documentType = '', variation = false } = {}) {
  return documentType === 'Skeleton Argument' && variation ? SKELETON_STRUCTURE : [];
}

const STOP = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'was', 'were', 'been', 'being', 'which',
  'there', 'their', 'what', 'when', 'where', 'would', 'could', 'should', 'must', 'into', 'than', 'then', 'them',
  'they', 'also', 'only', 'over', 'under', 'about', 'after', 'before', 'because', 'court', 'order', 'application',
  'para', 'paragraph', 'document', 'record', 'claimant', 'defendant', 'said', 'says', 'does', 'not',
]);

function termsOf(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 4 && !STOP.has(word))
  );
}

// Categories whose paragraphs always go in: the application notice, the statements and
// the transcript (delay and knowledge are answered from it).
const ALWAYS = { 'Application notices': 5, 'Witness statements': 4, Transcripts: 3 };

function scoreOf(segment, terms) {
  if (!terms.size) return 0;
  const haystack = ` ${String(segment.norm || segment.text || '').toLowerCase()} `;
  let hits = 0;
  terms.forEach((term) => {
    if (haystack.includes(term)) hits += 1;
  });
  return hits;
}

function keyOf(documentName, ref) {
  return `${documentName || ''}::${ref || ''}`;
}

// The paragraphs sent with the draft, each with its document id and paragraph number.
export function pickParagraphs({
  record = {},
  gateway = [],
  ourPoints = [],
  pinned = [],
  perDocument = 40,
  total = 120,
  budget = 200000,
} = {}) {
  const segments = record?.segments || [];

  const forced = new Set();
  const pin = (documentName, ref) => {
    if (documentName && ref) forced.add(keyOf(documentName, ref));
  };
  gateway.forEach((issue) => {
    pin(issue.ours?.document_name, issue.ours?.ref);
    pin(issue.theirs?.document_name, issue.theirs?.ref);
  });
  ourPoints.forEach((point) => pin(point.document_name, point.paragraph_ref));
  pinned.forEach((row) => pin(row.document_name, row.ref));

  const terms = new Set();
  const eat = (value) => termsOf(value).forEach((term) => terms.add(term));
  gateway.forEach((issue) => {
    eat(issue.title);
    eat(issue.ask);
    eat(issue.ours?.quote);
    eat(issue.theirs?.quote);
  });
  ourPoints.forEach((point) => eat(point.text));
  pinned.forEach((row) => eat(row.text));

  const perDoc = {};
  const rows = [];
  let chars = 0;

  segments.forEach((segment) => {
    const name = segment.document_name || 'Document';
    const byName = forced.has(keyOf(name, segment.ref));
    const byId = forced.has(keyOf(segment.document_id, segment.ref));
    const baseline = ALWAYS[segment.category] || 0;
    const score = scoreOf(segment, terms);
    const wanted = byName || byId || baseline >= 3 || score >= 2;
    if (!wanted) return;

    const used = perDoc[segment.document_id] || 0;
    if (used >= perDocument) return;
    if (rows.length >= total) return;
    const text = String(segment.text || '');
    if (chars + text.length > budget) return;

    perDoc[segment.document_id] = used + 1;
    chars += text.length;
    rows.push({
      document_id: segment.document_id,
      document_name: name,
      category: segment.category || '',
      role: segment.role || '',
      ref: segment.ref,
      text,
      why: byName || byId ? 'cited by the argument' : baseline >= 3 ? segment.category : 'matches the gateway issues',
    });
  });

  return { paragraphs: rows, chars, count: rows.length };
}

// Every paragraph of one document, for the pin control.
export function paragraphOptions(record = {}, documentName = '') {
  return (record?.segments || [])
    .filter((segment) => segment.document_name === documentName)
    .map((segment) => ({ document_name: segment.document_name, document_id: segment.document_id, ref: segment.ref, text: clip(segment.text, 140) }));
}

export function documentNames(record = {}) {
  return (record?.documents || []).map((doc) => doc.name);
}

function approachText(saved, issue) {
  if (!saved) return '';
  const labels = (saved.approach_ids || []).map((id) => approachById(issue, id)?.label || id);
  if (saved.own_approach) labels.push(saved.own_approach);
  return labels.filter(Boolean).join('; ');
}

function lineOf(answer) {
  if (!answer) return null;
  return { quote: answer.quote || '', document_name: answer.document_name || '', ref: answer.ref || '' };
}

// The request body for legalDocumentDraft: what the document is for, the full text of the
// relevant paragraphs, and the argument work it is built from.
export function buildDraftRequest({
  documentType = '',
  briefingNotes = '',
  ourSide = '',
  court = '',
  application = {},
  order = null,
  orderFound = false,
  variation = false,
  structure = [],
  paragraphs = [],
  gateway = [],
  savedByIssue = {},
  promptness = null,
  tests = [],
  extracts = [],
  registerItems = [],
  userStatements = [],
  supplementary = '',
  argument = null,
  pinned = [],
  recordDocuments = [],
  mainAuthorities = [],
  authorities = [],
} = {}) {
  return {
    documentType,
    briefingNotes,
    our_side: ourSide,
    court,
    application: {
      text: application.application || '',
      rule: application.rule || '',
      asks: application.asks || '',
      notice_name: application.notice?.name || '',
      notice_date: application.notice?.date || '',
    },
    order_challenged: {
      id: order?.id || '',
      name: order?.name || '',
      date: order?.date || '',
      date_text: order?.date_text || '',
      found: Boolean(order) && Boolean(orderFound),
    },
    variation,
    structure,
    record_paragraphs: paragraphs,
    pinned_refs: pinned.map((row) => `${row.document_name}, ${row.ref}`),
    gateway: (gateway || []).map((issue) => ({
      number: issue.number,
      title: issue.title,
      ask: issue.ask || '',
      our_answer: lineOf(issue.ours),
      their_answer: lineOf(issue.theirs),
      rating: issue.rating || '',
      approach: approachText(savedByIssue[issue.id], issue),
      explanation: savedByIssue[issue.id]?.explanation || '',
      status: savedByIssue[issue.id]?.status || '',
    })),
    promptness: promptness
      ? {
          interval: promptness.interval || '',
          days: promptness.days,
          note: promptness.note || '',
          order: promptness.order
            ? { name: promptness.order.name || '', date: promptness.order.date || '', date_text: promptness.order.date_text || '', ref: promptness.order.ref || '' }
            : null,
          application: promptness.application
            ? {
                name: promptness.application.name || '',
                date: promptness.application.date || '',
                date_text: promptness.application.date_text || '',
                ref: promptness.application.ref || '',
              }
            : null,
        }
      : null,
    legal_tests: (tests || []).map((test) => ({
      name: test.name || '',
      elements: (test.elements || []).map((element, index) => ({
        number: element.number || index + 1,
        text: element.text || '',
        paragraph_ref: element.source_paragraph_ref || '',
        extract_id: element.source_extract_id || '',
        against_us: Boolean(element.against_us),
      })),
    })),
    extracts: (extracts || []).map((extract) => ({
      case_name: extract.case_name || '',
      citation: extract.citation || '',
      paragraph_ref: extract.paragraph_ref || '',
      extract_text: extract.extract_text || '',
      proposition: extract.proposition || '',
      checked: extract.checked !== false,
    })),
    register_items: (registerItems || []).map((item) => ({
      title: item.title || '',
      type: item.type || '',
      status: item.status || 'Open',
      answer: item.answer?.answer || '',
      reason: item.reason || '',
    })),
    user_statements: (userStatements || []).map((statement) => ({ text: statement.text || '' })),
    supplementary_statement: supplementary || '',
    argument: argument || null,
    record_documents: recordDocuments || [],
    main_authorities: mainAuthorities || [],
    authorities: authorities || [],
  };
}