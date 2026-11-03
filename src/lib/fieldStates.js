// Three states for every field. Deterministic and record-first: a field only counts
// as "From the documents" when its wording is actually found in a record paragraph,
// in which case the exact quote and its document and reference are shown. Anything
// else is either written by the user or not yet provided.
import { normalise } from '@/lib/authorityCheck';
import { classifyNote } from '@/lib/noteClassify';

export const FIELD_STATE = {
  documents: 'From the documents',
  yours: 'Written by you',
  missing: 'Not yet provided',
};

export const USER_MARKER = '[USER STATEMENT - NO DOCUMENT REFERENCE]';

const STOP = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'which', 'their', 'there',
  'they', 'them', 'when', 'what', 'would', 'could', 'should', 'about', 'into', 'under',
  'also', 'than', 'then', 'such', 'shall', 'will',
]);

export function markUserStatement(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.includes(USER_MARKER) ? text : `${text} ${USER_MARKER}`;
}

export function splitSentences(block = '') {
  return String(block || '')
    .split(/\n+|(?<=[.;])\s+(?=[A-Z])/)
    .map((line) => line.replace(/^[\s\-•*\d.)]+/, '').trim())
    .filter((line) => line.length > 3);
}

function words(value) {
  return new Set(
    normalise(value)
      .split(' ')
      .filter((word) => word.length > 3 && !STOP.has(word))
  );
}

function overlap(left, right) {
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((word) => {
    if (b.has(word)) shared += 1;
  });
  return shared / Math.min(a.size, b.size);
}

function segmentsOf(record = {}) {
  return (record.segments || []).map((segment) => ({
    ...segment,
    norm: segment.norm || normalise(segment.text || ''),
  }));
}

// Where in the record this line actually appears, if anywhere.
export function findInRecord(line, record = {}) {
  const needle = normalise(line);
  if (needle.length < 18) return null;
  const segments = segmentsOf(record);
  const exact = segments.find((segment) => segment.norm.includes(needle.slice(0, 140)));
  if (exact) {
    return { document_name: exact.document_name, paragraph_ref: exact.ref, quote: exact.text };
  }
  const close = segments
    .map((segment) => ({ segment, score: overlap(line, segment.text) }))
    .filter((entry) => entry.score >= 0.8)
    .sort((a, b) => b.score - a.score)[0];
  if (close) {
    return {
      document_name: close.segment.document_name,
      paragraph_ref: close.segment.ref,
      quote: close.segment.text,
    };
  }
  return null;
}

function makeField({ key, group, label, prompt, quote, document_name, paragraph_ref, user_text, source_document, user_kind }) {
  const fromRecord = Boolean(quote && document_name);
  const written = String(user_text || '').trim();
  const state = fromRecord ? 'documents' : written ? 'yours' : 'missing';
  return {
    key,
    group,
    label: label || '',
    prompt: prompt || '',
    state,
    stateLabel: FIELD_STATE[state],
    quote: fromRecord ? quote : '',
    document_name: fromRecord ? document_name : '',
    paragraph_ref: fromRecord ? paragraph_ref || '' : '',
    user_text: written,
    source_document: source_document || '',
    user_kind: user_kind || 'fact',
  };
}

// Every field the argument rests on, with its state.
export function buildFieldGroups({
  record = {},
  gateway = [],
  ourPoints = [],
  clauses = [],
  misstatements = [],
  chronology = null,
  expansions = {},
  userFields = {},
} = {}) {
  const written = (key) => userFields[key] || {};
  const groups = [];

  const factLines = [
    ...splitSentences(expansions.undisputed_facts).map((text) => ({ text, label: 'Undisputed fact' })),
    ...splitSentences(expansions.disputed_facts).map((text) => ({ text, label: 'Disputed fact' })),
  ];
  groups.push({
    id: 'facts',
    label: 'Facts',
    hint: 'A fact is from the documents only when its wording is found in a record paragraph. Otherwise it is yours.',
    fields: (factLines.length ? factLines : [{ text: '', label: 'Fact' }]).map((entry, index) => {
      const key = `fact:${index}`;
      const hit = entry.text ? findInRecord(entry.text, record) : null;
      return makeField({
        key,
        group: 'facts',
        label: entry.label,
        prompt: entry.text || 'State the fact in one sentence.',
        quote: hit?.quote,
        document_name: hit?.document_name,
        paragraph_ref: hit?.paragraph_ref,
        user_text: written(key).text,
        source_document: written(key).source_document,
        // A note that objects to or criticises something is our position, not a fact.
        user_kind:
          written(key).group === 'position' || classifyNote(entry.text || written(key).text || '').kind === 'position'
            ? 'position'
            : 'fact',
      });
    }),
  });

  groups.push({
    id: 'points',
    label: 'Our points',
    hint: 'A point carries its document and paragraph, or it is a statement by you.',
    fields: ourPoints.length
      ? ourPoints.map((point, index) => {
          const key = `point:${index}`;
          const referenced = Boolean(point.text && point.document_name && point.paragraph_ref);
          return makeField({
            key,
            group: 'points',
            label: point.source || 'Our point',
            prompt: point.text || '',
            quote: referenced ? point.text : '',
            document_name: point.document_name,
            paragraph_ref: point.paragraph_ref,
            user_text: written(key).text,
          });
        })
      : [
          makeField({
            key: 'point:0',
            group: 'points',
            label: 'Our point',
            prompt: 'The point we make, in our words.',
            user_text: written('point:0').text,
          }),
        ],
  });

  groups.push({
    id: 'misstatements',
    label: 'Misstatements by the other side',
    hint: 'What they say, what is correct, and the document and paragraph that proves it.',
    fields: misstatements.length
      ? misstatements.map((entry, index) => {
          const key = `misstatement:${index}`;
          const referenced = Boolean(entry.document_name && entry.paragraph_ref);
          return makeField({
            key,
            group: 'misstatements',
            label: entry.statement || 'Misstatement',
            prompt: entry.correct_position || entry.statement || '',
            quote: referenced ? entry.statement : '',
            document_name: entry.document_name,
            paragraph_ref: entry.paragraph_ref,
            user_text: referenced ? '' : written(key).text || entry.correct_position || '',
          });
        })
      : [
          makeField({
            key: 'misstatement:0',
            group: 'misstatements',
            label: 'Misstatement',
            prompt: 'What they say, and what is actually correct.',
            user_text: written('misstatement:0').text,
          }),
        ],
  });

  groups.push({
    id: 'clauses',
    label: 'Contract clauses and rules',
    hint: 'The exact wording, with the document it comes from.',
    fields: clauses.length
      ? clauses.map((clause, index) => {
          const key = `clause:${index}`;
          return makeField({
            key,
            group: 'clauses',
            label: clause.reference || `Clause ${index + 1}`,
            prompt: clause.text || '',
            quote: clause.document_name ? clause.text : '',
            document_name: clause.document_name,
            paragraph_ref: clause.reference,
            user_text: written(key).text,
          });
        })
      : [
          makeField({
            key: 'clause:0',
            group: 'clauses',
            label: 'Clause',
            prompt: 'The clause reference and its exact wording.',
            user_text: written('clause:0').text,
          }),
        ],
  });

  const chronologyFields = [
    ...((chronology?.entries || []).map((entry, index) =>
      makeField({
        key: `chronology:record:${index}`,
        group: 'chronology',
        label: entry.date,
        prompt: entry.quote || entry.stated_as,
        quote: entry.quote || entry.stated_as,
        document_name: entry.document_name,
        paragraph_ref: entry.ref,
      })
    )),
    ...splitSentences(expansions.chronology).map((text, index) => {
      const key = `chronology:${index}`;
      const hit = findInRecord(text, record);
      return makeField({
        key,
        group: 'chronology',
        label: 'From your note',
        prompt: text,
        quote: hit?.quote,
        document_name: hit?.document_name,
        paragraph_ref: hit?.paragraph_ref,
        user_text: written(key).text || text,
        user_kind:
          written(key).group === 'position' || classifyNote(text).kind === 'position' ? 'position' : 'fact',
      });
    }),
  ];
  groups.push({
    id: 'chronology',
    label: 'Chronology',
    hint: 'Dated entries from the record, and any event you added yourself.',
    fields: chronologyFields.length
      ? chronologyFields
      : [
          makeField({
            key: 'chronology:0',
            group: 'chronology',
            label: 'Event',
            prompt: 'What happened, and when.',
            user_text: written('chronology:0').text,
          }),
        ],
  });

  groups.push({
    id: 'gateway',
    label: 'Gateway answers',
    hint: 'Each of the seven gateway issues, answered from the record or in your own words.',
    fields: gateway.map((issue) => {
      const key = `gateway:${issue.id}`;
      return makeField({
        key,
        group: 'gateway',
        label: `${issue.number}. ${issue.title}`,
        prompt: issue.ask,
        quote: issue.ours?.quote,
        document_name: issue.ours?.document_name,
        paragraph_ref: issue.ours?.ref,
        user_text: written(key).text,
        source_document: written(key).source_document,
      });
    }),
  });

  return groups;
}

export function groupCounts(groups = []) {
  const all = groups.flatMap((group) => group.fields);
  return {
    total: all.length,
    documents: all.filter((field) => field.state === 'documents').length,
    yours: all.filter((field) => field.state === 'yours').length,
    missing: all.filter((field) => field.state === 'missing').length,
  };
}

// Everything the user wrote, marked so it can never be read as record evidence.
export function userStatementLines(groups = []) {
  return groups
    .flatMap((group) => group.fields)
    .filter((field) => field.state === 'yours')
    .map((field) => ({
      key: field.key,
      group: field.group,
      label: field.user_kind === 'position' ? `${field.label} (our position)` : field.label,
      kind: field.user_kind || 'fact',
      text: markUserStatement(field.user_text),
      source_document: field.source_document || '',
    }));
}

export function missingFields(groups = []) {
  return groups
    .flatMap((group) => group.fields)
    .filter((field) => field.state === 'missing')
    .map((field) => ({ key: field.key, group: field.group, label: field.label, prompt: field.prompt }));
}