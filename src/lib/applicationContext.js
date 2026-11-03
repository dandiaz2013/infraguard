// What the document being drafted is for: the application, the order challenged,
// our side and the court. Deterministic only - read from the case file, never guessed.
import { confirmedDate, detectDocumentDate, formatDate, toIsoDate } from '@/lib/documentDate';

export const DECISION_CATEGORIES = ['Orders', 'Judgments'];

const RULE = /\bCPR\s?\d+(?:\.\d+)*(?:\([a-z0-9]+\))*/i;
const JUDGE =
  /(?:Deputy Master|Master|District Judge|Deputy District Judge|HHJ|Recorder|Judge)\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)?/;
const NAMED = [
  /order of\s+(?:Deputy Master|Master|District Judge|HHJ|Recorder|Judge)\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)?[^.\n]{0,24}?\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}/i,
  /(?:order|judgment)\s+(?:dated|of)\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}/i,
];
// The whole line: a full stop inside "CPR 3.1(7)" must not cut the sentence short.
const ASKS = /[^\n]*\b(?:applies?|applying|seeks?|asks?|requests?)\b[^\n]*/i;

// Orders and judgments in the case file, with the date read from the document itself.
export function decisionDocuments(documents = []) {
  return (documents || [])
    .filter((doc) => DECISION_CATEGORIES.includes(doc.category))
    .map((doc) => {
      const date = confirmedDate(doc) || detectDocumentDate(doc.text || '', doc.category).date || '';
      return {
        id: doc.id,
        name: doc.file_name || doc.name || 'Document',
        category: doc.category,
        date,
        date_text: formatDate(date),
        ticked: Boolean(doc.ticked),
      };
    });
}

export function applicationNotice(documents = []) {
  return (documents || []).find(
    (doc) => doc.category === 'Application notices' && String(doc.text || '').trim().length > 0
  );
}

// The application, the order challenged and what the document is for.
export function applicationDetails({ documents = [], orderId = '', summary = '' } = {}) {
  const choices = decisionDocuments(documents);
  const notice = applicationNotice(documents);
  const body = String(notice?.text || '');

  const rule = (body.match(RULE) || [])[0] || '';
  const asks = ((body.match(ASKS) || [])[0] || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const named = NAMED.map((pattern) => (body.match(pattern) || [])[0] || '').find(Boolean) || '';
  const namedDate = named ? toIsoDate(named) : '';
  const namedJudge = (named.match(JUDGE) || [])[0] || '';

  const byId = choices.find((choice) => choice.id === orderId) || null;
  const byDate = namedDate ? choices.find((choice) => choice.date === namedDate) || null : null;
  const order = byId || byDate || choices[0] || null;

  const auto = [rule, asks].filter(Boolean).join(' ').trim();
  const application =
    String(summary || '').trim() ||
    auto ||
    'The application notice does not state the rule or what is asked for. Say what the application is for.';

  return {
    notice: notice
      ? {
          id: notice.id,
          name: notice.file_name || 'Application notice',
          date: confirmedDate(notice) || detectDocumentDate(body, 'Application notices').date || '',
        }
      : null,
    rule,
    asks,
    named,
    namedDate,
    namedJudge,
    application,
    choices,
    order,
    // Named in the application notice but not an order or judgment in the case file.
    namedOrderMissing: Boolean(named) && !byDate && !byId && choices.length === 0,
  };
}

// An application to vary, revoke, set aside or reopen.
export function isVariation(details = {}) {
  const source = `${details.application || ''} ${details.rule || ''} ${details.asks || ''} ${details.named || ''}`;
  return /\bset aside\b|\bvary\b|\bvariation\b|\brevoke\b|\brevocation\b|\breopen\b|\breopening\b/i.test(source);
}

// Only the order chosen is the order challenged. Every other order and judgment is background.
export function documentLabels(documents = [], challengedId = '') {
  return (documents || []).map((doc) => {
    const date = confirmedDate(doc) || detectDocumentDate(doc.text || '', doc.category || '').date || '';
    const base = {
      id: doc.id,
      name: doc.file_name || doc.name || 'Document',
      category: doc.category || 'Other',
      date,
      date_text: formatDate(date),
    };
    if (challengedId && doc.id === challengedId) return { ...base, label: 'THE ORDER CHALLENGED' };
    if (DECISION_CATEGORIES.includes(doc.category)) {
      return { ...base, label: 'Earlier decision, background' };
    }
    return { ...base, label: '' };
  });
}