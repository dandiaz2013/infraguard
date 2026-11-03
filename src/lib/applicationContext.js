// What the document being drafted is for: the application, the order challenged,
// our side and the court. Deterministic only - read from the case file, never guessed.
import { confirmedDate, detectDocumentDate, formatDate, toIsoDate } from '@/lib/documentDate';

export const DECISION_CATEGORIES = ['Orders', 'Judgments'];

const RULE = /\bCPR\s?\d+(?:\.\d+)*(?:\([a-z0-9]+\))*/i;

const NAME = "[A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+)?";
// Longest titles first so "Mrs Justice" is read as a title, not as a name.
const TITLES = [
  'Honourable Mr Justice',
  'Honourable Mrs Justice',
  'Honourable Ms Justice',
  'Lord Justice',
  'Lady Justice',
  'Mr Justice',
  'Mrs Justice',
  'Ms Justice',
  'His Honour Judge',
  'Her Honour Judge',
  'Deputy District Judge',
  'Deputy Master',
  'District Judge',
  'Honourable',
  'Master',
  'Recorder',
  'Judge',
  'HHJ',
  'Sir',
  'Dame'
];
const TITLE_SRC = `(?:${TITLES.join('|')})`;

// "Mrs Justice Eady", "Lord Justice Sales", "Sir John Smith", "Master Brown".
const JUDGE = new RegExp(`${TITLE_SRC}\\s+${NAME}`);

// The whole line: a full stop inside "CPR 3.1(7)" must not cut the sentence short.
const ASKS = /[^\n]*\b(?:applies?|applying|seeks?|asks?|requests?)\b[^\n]*/i;

const DATE_TEXT = '\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Z][a-z]+\\s+\\d{4}';

// "the order of Mrs Justice Eady dated 25 March 2025" is a named order with its date.
const NAMED = [
  new RegExp(`(?:order|judgment)\\s+(?:of|dated|made by)\\s+${TITLE_SRC}\\s+${NAME}[^.\\n]{0,40}?${DATE_TEXT}`, 'i'),
  new RegExp(`(?:order|judgment)\\s+(?:dated|of)\\s+${DATE_TEXT}`, 'i')
];

// The judge named in a document: "Before Mrs Justice Eady", "MASTER BROWN".
const DOC_JUDGE = [
  /\b(?:Mr|Mrs|Ms|Lord|Lady)\s+Justice\s+([A-Z][A-Za-z'’-]+)/,
  /\b(?:MR|MRS|MS|LORD|LADY)\s+JUSTICE\s+([A-Z][A-Z]+)/,
  /\b(?:His Honour Judge|Her Honour Judge|Deputy District Judge|District Judge|Deputy Master|Master|Recorder|Judge|HHJ)\s+([A-Z][A-Za-z'’-]+)/
];

const TITLE_WORDS = new Set([
  'lord', 'lady', 'mr', 'mrs', 'ms', 'justice', 'honourable', 'hon', 'his', 'her',
  'honour', 'hhj', 'deputy', 'master', 'district', 'judge', 'recorder', 'sir', 'dame'
]);

// "Mrs Justice Eady" and "EADY" both give "Eady"; "Sir John Smith" gives "Smith".
export function judgeSurname(judge = '') {
  const words = String(judge)
    .replace(/[^A-Za-z'’\- ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && TITLE_WORDS.has(words[0].toLowerCase())) words.shift();
  return words.length ? words[words.length - 1] : '';
}

function judgeInDocument(text = '') {
  const head = String(text || '').slice(0, 2500);
  for (const pattern of DOC_JUDGE) {
    const hit = head.match(pattern);
    if (hit) return hit[1];
  }
  return '';
}

const sameJudge = (a, b) => Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase();

// Orders and judgments in the case file, with the date and judge read from the document.
export function decisionDocuments(documents = []) {
  return (documents || [])
    .filter((doc) => DECISION_CATEGORIES.includes(doc.category))
    .map((doc) => {
      const date = confirmedDate(doc) || detectDocumentDate(doc.text || '', doc.category).date || '';
      return {
        id: doc.id,
        name: doc.file_name || doc.name || 'Document',
        category: doc.category,
        judge: judgeInDocument(doc.text),
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
  const namedSurname = judgeSurname(namedJudge);

  // A document matches on the date the application notice names and on the judge.
  // A document that names no judge cannot contradict the name, so it may match on
  // the date; a document that names another judge does not match.
  let matched = [];
  if (namedDate) {
    const sameDate = choices.filter((choice) => choice.date === namedDate);
    const agreeing = sameDate.filter(
      (choice) => !choice.judge || !namedSurname || sameJudge(choice.judge, namedSurname)
    );
    const byJudge = agreeing.filter((choice) => sameJudge(choice.judge, namedSurname));
    matched = byJudge.length ? byJudge : agreeing;
  }

  const chosen = choices.find((choice) => choice.id === orderId) || null;
  // Only an order is the order challenged. Nothing is defaulted to the first decision.
  const order = chosen || matched.find((choice) => choice.category === 'Orders') || null;
  const judgment =
    chosen || order ? null : matched.find((choice) => choice.category === 'Judgments') || null;

  const suggested = judgment
    ? { ...judgment, note: 'This is the judgment; upload the order as well' }
    : null;

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
    // The date and judge this application is about, with only the judgment in the file.
    suggested,
    // Named in the application notice but not matched to an order or judgment in the case file.
    namedOrderMissing: Boolean(named) && !order,
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