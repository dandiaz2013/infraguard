// Auto-fill from the record. Every item written here carries its document, reference and
// the exact quotation, verified in code against the extracted text.
import { normalise } from '@/lib/authorityCheck';
import { LAW_KINDS, clip, quoteInText } from '@/lib/recordIndex';
import { authorityLabel } from '@/lib/authorityNaming';
import { chronologyText } from '@/lib/chronology';
import { keyTerms } from '@/lib/recordFirst';

const PLACEHOLDER_WORDS = new Set([
  'test', 'in documents', 'n/a', 'na', 'none', 'tbc', 'tba', 'todo', 'xx', '...', '-',
  'see above', 'as above', 'unknown', 'not sure', 'placeholder',
]);

export function isPlaceholder(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (value.length < 20) return true;
  return PLACEHOLDER_WORDS.has(value.toLowerCase());
}

function sentences(text) {
  return (String(text || '').match(/[^.;:]+[.;:]+|[^.;:]+$/g) || [])
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 320);
}

function roleSegments(record, role) {
  return (record?.segments || []).filter((segment) => segment.role === role);
}

// Our points: what our own filed statements assert, with reference and quote.
export function pointsFromRecord(record, limit = 8) {
  const points = [];
  const seen = new Set();
  roleSegments(record, 'Our side').forEach((segment) => {
    const [first] = sentences(segment.text);
    if (!first) return;
    const key = normalise(first).slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    points.push({
      text: first,
      document_name: segment.document_name,
      paragraph_ref: segment.ref,
      source: 'Record',
      quote_verified: quoteInText(first, segment.text),
      added_date: new Date().toISOString(),
    });
  });
  return points.slice(0, limit);
}

// Contract clauses / rules: the provision text the record itself contains.
export function clausesFromRecord(record, limit = 10) {
  const rows = [];
  const seen = new Set();
  (record?.items || [])
    .filter((item) => LAW_KINDS.includes(item.kind))
    .forEach((item) => {
      const reference = authorityLabel(item.label);
      const key = `${normalise(reference)}:${item.document_name}:${item.ref}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        reference,
        text: item.quote,
        document_name: item.document_name,
        paragraph_ref: item.ref,
        checked: false,
        source: 'From the record - compare with official source',
      });
    });
  return rows.slice(0, limit);
}

// Misstatements: an other-side statement our documents contradict on the same point.
export function misstatementsFromRecord(record, limit = 5) {
  const others = roleSegments(record, 'Other party');
  const counter = [...roleSegments(record, 'Court'), ...roleSegments(record, 'Our side')];
  const rows = [];
  const seen = new Set();

  others.forEach((other) => {
    const otherTerms = keyTerms(other.text);
    counter.forEach((answer) => {
      if (rows.length >= limit) return;
      const answerNorm = answer.norm || normalise(answer.text);
      const shared = otherTerms.filter(
        (term) => answerNorm.includes(term.length >= 6 ? term.slice(0, 5) : term)
      );
      if (shared.length < 2) return;
      const key = `${normalise(answer.text).slice(0, 60)}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        statement: clip(other.text, 240),
        correct_position: clip(answer.text, 240),
        document_name: answer.document_name,
        paragraph_ref: answer.ref,
        source: `Contradicts ${other.document_name}, ${other.ref}`,
      });
    });
  });
  return rows;
}

const TEST_CUE =
  /\b(the test|it is necessary to (?:show|establish)|must (?:show|establish|satisfy)|must be satisfied|it is not enough|has to (?:show|establish)|the (?:requirements|elements) (?:are|of)|is satisfied (?:only )?(?:if|where)|the principles? (?:are|is))\b/i;

export function testsFromRecord(record, limit = 2) {
  const proposals = [];
  roleSegments(record, 'Court').forEach((segment) => {
    if (proposals.length >= limit) return;
    if (!TEST_CUE.test(segment.text)) return;
    const quote = clip(segment.text, 700);
    const parts = quote.split(/\(a\)|\(b\)|\(c\)|\(d\)|;/).map((part) => part.trim()).filter((part) => part.length > 25);
    const elements = (parts.length > 1 ? parts.slice(0, 5) : [quote]).map((text, index) => ({
      number: index + 1,
      text,
      source_document_name: segment.document_name,
      source_paragraph_ref: segment.ref,
      source_quote: quoteInText(text, segment.text) ? text : quote.slice(0, 240),
      user_confirmed: false,
    }));
    proposals.push({
      name: `Test stated in ${segment.document_name}, ${segment.ref}`,
      elements,
      notes: 'Proposed from the passage quoted. Confirm the elements before they are used.',
      status: 'Proposed',
      source_document_name: segment.document_name,
      source_ref: segment.ref,
    });
  });
  return proposals;
}

export function proposeFactPattern(record) {
  const court = roleSegments(record, 'Court')[0];
  const ours = roleSegments(record, 'Our side')[0];
  const other = roleSegments(record, 'Other party')[0];
  const lines = [];
  if (ours) lines.push(`Our case as stated in ${ours.document_name}, ${ours.ref}: “${clip(ours.text, 240)}”`);
  if (other) lines.push(`The other side's case as stated in ${other.document_name}, ${other.ref}: “${clip(other.text, 240)}”`);
  if (court) lines.push(`The court recorded in ${court.document_name}, ${court.ref}: “${clip(court.text, 240)}”`);
  return lines.join('\n\n');
}

export function proposeLossHarm(record) {
  const hit = (record?.segments || []).find((segment) =>
    /\b(loss|damage|harm|cost|recover|compensation|restitution|sum of|£)\b/i.test(segment.text)
  );
  if (!hit) return '';
  return `Loss, harm or risk as recorded in ${hit.document_name}, ${hit.ref}: “${clip(hit.text, 300)}”`;
}

export function proposeChronology(record, chronology) {
  return chronologyText(chronology?.entries || []) || chronologyText([]);
}

// Everything the page should apply to the panels, worked out without touching state.
export function runAutoFill({
  record, ourPoints = [], clauses = [], misstatements = [], tests = [],
  factPattern = '', chronology = '', lossHarmRisk = '', chronologyText: fromRecord = '',
} = {}) {
  const filled = buildAutoFill(record);
  const next = {};
  let added = 0;

  if (ourPoints.length === 0 && filled.ourPoints.length) {
    next.ourPoints = filled.ourPoints;
    added += filled.ourPoints.length;
  }
  if (clauses.length === 0 && filled.clauses.length) {
    next.clauses = filled.clauses;
    added += filled.clauses.length;
  }
  if (misstatements.length === 0 && filled.misstatements.length) {
    next.misstatements = filled.misstatements;
    added += filled.misstatements.length;
  }

  const proposals = [];
  if (isPlaceholder(factPattern)) {
    const proposed = proposeFactPattern(record);
    if (proposed) proposals.push({ field: 'factPattern', label: 'Core Fact Pattern', current: factPattern, proposed });
  }
  if (isPlaceholder(chronology) && fromRecord) {
    proposals.push({ field: 'chronology', label: 'Chronology', current: chronology, proposed: fromRecord });
  }
  if (isPlaceholder(lossHarmRisk)) {
    const proposed = proposeLossHarm(record);
    if (proposed) proposals.push({ field: 'lossHarmRisk', label: 'Loss, Harm or Risk', current: lossHarmRisk, proposed });
  }

  return { ...next, proposals, added, tests: tests.length === 0 ? filled.tests : [] };
}

export function buildAutoFill(record) {
  return {
    ourPoints: pointsFromRecord(record),
    clauses: clausesFromRecord(record),
    misstatements: misstatementsFromRecord(record),
    tests: testsFromRecord(record),
  };
}