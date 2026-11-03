// Deterministic two-axis rating for a gateway issue. No AI, no percentages, no
// success scores: Evidence says what the record proves, Argument says how well the
// chosen approach is prepared. Our own witness statement is our position, never
// evidence of what the court did.
import { normalise } from '@/lib/authorityCheck';

export const RATINGS = ['Weak', 'Arguable', 'Reasonable', 'Strong'];

export const APPROACHES = [
  {
    id: 'misstatement',
    label: 'Misstatement of fact',
    needs: 'A document from the court or the other side that states the fact differently.',
    risk: 'The court may prefer the original account where our document does not contradict it squarely.',
  },
  {
    id: 'omission',
    label: 'Omission',
    needs: 'A passage showing the point was never put to the court before the order was made.',
    risk: 'An omission only helps if the point would have changed the outcome.',
  },
  {
    id: 'change',
    label: 'Change of circumstances',
    needs: 'Evidence of the change, dated after the order.',
    risk: 'A change after the order does not show the order was wrong when made.',
  },
];

const STOPWORDS = new Set([
  'about', 'after', 'before', 'being', 'court', 'issue', 'order', 'their', 'there', 'these',
  'which', 'while', 'would', 'should', 'could', 'under', 'where', 'with', 'from', 'that', 'this',
  'have', 'been', 'made', 'must', 'such', 'than', 'then', 'them', 'they', 'what', 'when'
]);

export function rankOf(rating) {
  const index = RATINGS.indexOf(rating);
  return index < 0 ? 0 : index;
}

export function raise(rating, steps = 1) {
  return RATINGS[Math.min(RATINGS.length - 1, rankOf(rating) + steps)];
}

export function lower(rating, steps = 1) {
  return RATINGS[Math.max(0, rankOf(rating) - steps)];
}

function keywords(issue = {}) {
  const text = `${issue.label || ''} ${issue.text || ''} ${issue.issue || ''}`;
  return [
    ...new Set(
      normalise(text)
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 4 && !STOPWORDS.has(word))
    )
  ].slice(0, 8);
}

// Which passages of the record speak to this issue, and who they come from.
export function recordEvidenceFor(issue = {}, record = {}) {
  const words = keywords(issue);
  const segments = record.segments || [];
  const hits = segments.filter((segment) => {
    if (!words.length) return false;
    const text = normalise(segment.text);
    return words.some((word) => text.includes(word));
  });
  const fromCourtOrOther = hits.filter(
    (segment) => segment.role === 'Court' || segment.role === 'Other side' || segment.role === 'Other party'
  );
  const fromOurs = hits.filter((segment) => segment.role === 'Our side');
  return { words, hits, fromCourtOrOther, fromOurs };
}

function checkedExtractsFor(issue = {}, extracts = []) {
  const words = keywords(issue);
  return (extracts || []).filter((extract) => {
    if (extract.status && !/checked/i.test(extract.status)) return false;
    if (!words.length) return Boolean(issue.approach_id);
    const text = normalise(`${extract.proposition || ''} ${extract.extract_text || ''}`);
    return words.some((word) => text.includes(word));
  });
}

export function evidenceRating({ issue = {}, record = {}, extracts = [] } = {}) {
  const evidence = recordEvidenceFor(issue, record);
  const checked = checkedExtractsFor(issue, extracts);
  const reasons = [];
  let rating = 'Weak';

  if (evidence.fromCourtOrOther.length > 0) {
    const first = evidence.fromCourtOrOther[0];
    rating = raise(rating, 1);
    reasons.push(`The record shows it: “${first.text.slice(0, 120)}” (${first.document_name}, ${first.ref}).`);
  }
  if (evidence.fromOurs.length > 0) {
    reasons.push(
      `Our own witness statement says something about it (${evidence.fromOurs[0].document_name}, ${evidence.fromOurs[0].ref}), which is our position, not evidence that the court relied on it.`
    );
  }
  if (checked.length > 0) {
    rating = raise(rating, evidence.fromCourtOrOther.length > 0 ? 2 : 1);
    reasons.push(
      `${checked.length} checked extract${checked.length === 1 ? '' : 's'} support${checked.length === 1 ? 's' : ''} it (${checked
        .map((extract) => `para ${extract.paragraph_ref || 'not recorded'}`)
        .join(', ')}).`
    );
  }
  if (reasons.length === 0) {
    reasons.push('No document from the court or the other side, and no checked extract, addresses this.');
  }

  return { rating, reasons, passages: evidence.fromCourtOrOther.slice(0, 4), checked };
}

export function argumentRating({ approach = null, explanation = '', explanationRef = {} } = {}) {
  const reasons = [];
  let rating = 'Weak';

  if (approach && approach.id) {
    rating = raise(rating);
    reasons.push(`Approach chosen: ${approach.label}.`);
  }
  const written = String(explanation || '').trim();
  if (written.length >= 20) {
    rating = raise(rating);
    reasons.push('You explained it in your own words.');
  }
  const located = Boolean(explanationRef?.document_name || explanationRef?.quote || explanationRef?.ref);
  if (written.length >= 20 && located) {
    rating = raise(rating);
    reasons.push(
      `The explanation points to the record (${explanationRef.document_name || 'document'}${
        explanationRef.ref ? `, ${explanationRef.ref}` : ''
      }).`
    );
  }
  if (reasons.length === 0) reasons.push('Nothing has been chosen or written for this issue yet.');

  return { rating, reasons };
}

export function statusFor({ evidence, argument, checked = [] }) {
  if (checked.length > 0 && rankOf(evidence.rating) >= rankOf('Arguable')) {
    return 'Evidenced and backed by a checked authority';
  }
  if (rankOf(evidence.rating) >= rankOf('Arguable')) return 'Evidenced';
  if (rankOf(argument.rating) > rankOf('Weak')) return 'Explained, not evidenced';
  return 'Not addressed';
}

// Before -> after, with the reason, so the user can see what moved and why.
export function rateIssue({
  issue = {},
  approach = null,
  explanation = '',
  explanationRef = {},
  record = {},
  extracts = [],
  previous = null,
} = {}) {
  const evidence = evidenceRating({ issue, record, extracts });
  const argument = argumentRating({ approach, explanation, explanationRef });
  // A well-prepared argument cannot be Strong while the record does not prove it.
  if (rankOf(evidence.rating) < rankOf('Reasonable') && argument.rating === 'Strong') {
    argument.rating = 'Reasonable';
    argument.reasons.push('Held at Reasonable: the record does not prove it yet.');
  }
  const status = statusFor({ evidence, argument, checked: evidence.checked });

  const changes = [];
  if (previous) {
    if (previous.evidence && previous.evidence !== evidence.rating) {
      changes.push({
        dimension: 'Evidence',
        before: previous.evidence,
        after: evidence.rating,
        reason: evidence.reasons[evidence.reasons.length - 1],
      });
    }
    if (previous.argument && previous.argument !== argument.rating) {
      changes.push({
        dimension: 'Argument',
        before: previous.argument,
        after: argument.rating,
        reason: argument.reasons[argument.reasons.length - 1],
      });
    }
  }

  return { evidence, argument, status, changes, issue_id: issue.id || issue.label || '' };
}

// What would move the weakest issue up one step.
export function nextStepFor(entry = {}) {
  if (entry.next_step) return entry.next_step;
  const evidence = entry.evidence || {};
  if (!(evidence.passages || []).length) {
    return 'find a document from the court or the other side that addresses it.';
  }
  if (!(evidence.checked || []).length) {
    return 'add the checked extract that supports it.';
  }
  return 'quote the paragraph that proves it in the draft.';
}

// "Weakest issue sets the ceiling".
export function ceilingLine(rates = []) {
  if (!rates.length) return '';
  const weakest = rates.reduce((low, entry) =>
    rankOf(entry.evidence?.rating) < rankOf(low.evidence?.rating) ? entry : low
  );
  return `Weakest issue sets the ceiling: ${weakest.label || weakest.issue_id}. To raise it: ${nextStepFor(weakest)}`;
}