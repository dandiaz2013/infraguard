// Deterministic prospects checklist. No AI, no percentage, no prediction of outcome.
import { checkQuotations, normalise } from '@/lib/authorityCheck';

export const RATINGS = ['Weak', 'Arguable', 'Reasonable', 'Strong'];

const CHECKED = 'Extract checked against official text';

const MARKERS = {
  authority: /\[AUTHORITY NEEDED[^\]]*\]/gi,
  fact: /\[FACT NEEDED[^\]]*\]/gi,
  rule: /\[RULE TEXT NEEDED[^\]]*\]/gi,
};

const USER_STATEMENT = /\[USER STATEMENT - NO DOCUMENT REFERENCE\]/gi;

const PROCEDURAL_KEYS = [
  ['court_confirmed', 'court'],
  ['route_confirmed', 'route'],
  ['time_limit_confirmed', 'time limit'],
];

function countMatches(text, pattern) {
  const found = String(text || '').match(pattern);
  return found ? found.length : 0;
}

function hasReference(record) {
  return Boolean(record && record.document_name && record.paragraph_ref);
}

function makeItem(id, label, priority, result, reason, fix, effort, button) {
  return { id, label, priority, result, reason, fix, effort, button };
}

export function computeProspects({
  text = '',
  questions = [],
  ourPoints = [],
  clauses = [],
  misstatements = [],
  procedural = {},
  caseLaw = [],
  extracts = [],
} = {}) {
  const draft = String(text || '');
  const checklist = [];

  // 1. Legal test supported by a stored extract
  const quotations = checkQuotations(draft, extracts);
  const matched = quotations.filter((entry) => entry.matched);
  const testExtract = matched
    .map((entry) => extracts.find((extract) => normalise(extract.extract_text).includes(normalise(entry.quote))))
    .filter(Boolean)
    .find((extract) => /\btest\b/i.test(`${extract.proposition || ''} ${extract.extract_text || ''}`));

  checklist.push(
    makeItem(
      'legal_test',
      'Legal test identified and supported by a stored authority extract',
      'High',
      testExtract ? 'Yes' : matched.length > 0 ? 'Partly' : 'No',
      testExtract
        ? `The stored extract at ${testExtract.paragraph_ref || 'no paragraph reference'} states the test.`
        : matched.length > 0
          ? `${matched.length} stored extract${matched.length === 1 ? ' is' : 's are'} quoted, but none of them states the legal test.`
          : 'No stored authority extract is quoted in the argument.',
      'Add the authority extract that states the legal test.',
      'Medium',
      'authority'
    )
  );

  // 2. Key authorities checked against the official text
  const draftNorm = normalise(draft);
  const cited = caseLaw.filter((record) => {
    const name = normalise(record.name);
    const citation = normalise(record.neutral_citation);
    return (name && draftNorm.includes(name)) || (citation && draftNorm.includes(citation));
  });
  const unchecked = cited.filter((record) => record.check_status !== CHECKED);
  checklist.push(
    makeItem(
      'authority_checked',
      'Each key authority checked against the official text',
      'High',
      cited.length === 0 ? 'No' : unchecked.length === 0 ? 'Yes' : unchecked.length === cited.length ? 'No' : 'Partly',
      cited.length === 0
        ? 'No authority from the Case Law Library is named in the argument.'
        : `${cited.length} key authorit${cited.length === 1 ? 'y' : 'ies'} cited; not checked: ${unchecked.map((record) => record.name).join(', ') || 'none'}.`,
      'Check the unchecked authority extracts against the official judgment.',
      'Low',
      'authority'
    )
  );

  // 3. Key facts backed by a document and paragraph
  const pointsWithReference = ourPoints.filter(hasReference);
  checklist.push(
    makeItem(
      'facts_supported',
      'Each key fact supported by an uploaded document with a paragraph reference',
      'High',
      ourPoints.length === 0 ? 'No' : pointsWithReference.length === ourPoints.length ? 'Yes' : pointsWithReference.length === 0 ? 'No' : 'Partly',
      ourPoints.length === 0
        ? 'No key fact has been recorded as one of Our points.'
        : `${pointsWithReference.length} of ${ourPoints.length} Our points carry a document and paragraph reference.`,
      'Record the document and paragraph behind each key fact.',
      'Medium',
      'point'
    )
  );

  // 4. Unresolved evidence conflicts
  const flagged = questions.filter((question) => question.conflict);
  const unresolved = flagged.filter((question) => !question.conflict_resolution);
  checklist.push(
    makeItem(
      'conflicts',
      'Evidence conflicts unresolved',
      'High',
      flagged.length === 0 ? 'Yes' : unresolved.length === 0 ? 'Yes' : unresolved.length === flagged.length ? 'No' : 'Partly',
      flagged.length === 0
        ? 'No answer has been flagged as contradicting a document.'
        : `${unresolved.length} of ${flagged.length} flagged conflict${flagged.length === 1 ? '' : 's'} still unresolved.`,
      'Decide which version is right for each flagged conflict.',
      'Low',
      'question'
    )
  );

  // 5. Points resting on the user's account only
  const statementPoints = ourPoints.filter((point) => !hasReference(point)).length;
  const statementMarkers = countMatches(draft, USER_STATEMENT);
  const statements = Math.max(statementPoints, statementMarkers);
  checklist.push(
    makeItem(
      'user_statements',
      'Our points marked [USER STATEMENT - NO DOCUMENT REFERENCE]',
      'Medium',
      statements === 0 ? 'Yes' : statements <= 2 ? 'Partly' : 'No',
      `${statements} point${statements === 1 ? '' : 's'} rest${statements === 1 ? 's' : ''} on the user's account with no document reference.`,
      'Add a document reference to each unsupported point.',
      'Medium',
      'document'
    )
  );

  // 6. Contract clauses and rules stored and checked
  const uncheckedClauses = clauses.filter((clause) => !clause.checked);
  checklist.push(
    makeItem(
      'clauses',
      'Contract clauses / rules relied on are stored and checked',
      'Medium',
      clauses.length === 0 ? 'No' : uncheckedClauses.length === 0 ? 'Yes' : 'Partly',
      clauses.length === 0
        ? 'No contract clause or rule has been stored.'
        : `${clauses.length} stored, ${uncheckedClauses.length} not yet checked against the document.`,
      'Store the clause text and confirm it word for word.',
      'Low',
      'clause'
    )
  );

  // 7. Misstatements supported by evidence
  const unsupportedMisstatements = misstatements.filter((entry) => !entry.document_name);
  checklist.push(
    makeItem(
      'misstatements',
      'Misstatements supported by evidence',
      'Medium',
      misstatements.length === 0 ? 'No' : unsupportedMisstatements.length === 0 ? 'Yes' : 'Partly',
      misstatements.length === 0
        ? 'No misstatement by the other side has been recorded.'
        : `${misstatements.length} recorded, ${unsupportedMisstatements.length} without a supporting document.`,
      'Attach the document that proves each misstatement.',
      'Low',
      'document'
    )
  );

  // 8. Open markers left in the draft
  const authorityMarkers = countMatches(draft, MARKERS.authority);
  const factMarkers = countMatches(draft, MARKERS.fact);
  const ruleMarkers = countMatches(draft, MARKERS.rule);
  const openMarkers = authorityMarkers + factMarkers + ruleMarkers;
  checklist.push(
    makeItem(
      'open_markers',
      'Open [AUTHORITY NEEDED], [FACT NEEDED] and [RULE TEXT NEEDED] markers',
      'High',
      openMarkers === 0 ? 'Yes' : openMarkers <= 2 ? 'Partly' : 'No',
      `${openMarkers} open marker${openMarkers === 1 ? '' : 's'} (${authorityMarkers} authority, ${factMarkers} fact, ${ruleMarkers} rule text).`,
      'Close each open marker with the missing authority, fact or rule text.',
      'Medium',
      'authority'
    )
  );

  // 9. Procedural fit
  const missingProcedural = PROCEDURAL_KEYS.filter(([key]) => !procedural?.[key]).map(([, label]) => label);
  checklist.push(
    makeItem(
      'procedural',
      'Procedural fit: court, route and time limits identified from the documents',
      'High',
      missingProcedural.length === 0 ? 'Yes' : missingProcedural.length === 1 ? 'Partly' : 'No',
      missingProcedural.length === 0
        ? 'Court, route and time limit are all confirmed.'
        : `Not confirmed: ${missingProcedural.join(', ')}.`,
      'Confirm the court, route and time limit against the documents.',
      'Low',
      'question'
    )
  );

  // Rating: base level from the checks, then the caps.
  const score =
    checklist.reduce((total, item) => total + (item.result === 'Yes' ? 1 : item.result === 'Partly' ? 0.5 : 0), 0) /
    checklist.length;

  let index = score >= 0.85 ? 3 : score >= 0.65 ? 2 : score >= 0.4 ? 1 : 0;
  const notes = [];

  const highGaps = checklist.filter((item) => item.priority === 'High' && item.result === 'No');
  if (highGaps.length > 0) {
    index = Math.max(0, index - 1);
    notes.push(`A High-priority gap (${highGaps[0].label.toLowerCase()}) lowers the rating by one level.`);
  }

  const authorityUnchecked = checklist.find((item) => item.id === 'authority_checked');
  if (authorityUnchecked.result !== 'Yes' && index > 1) {
    index = 1;
    notes.push('Unchecked key authorities cap the rating at Arguable.');
  }

  const fullyMet = checklist.filter((item) => item.result === 'Yes').length;
  const partlyMet = checklist.filter((item) => item.result === 'Partly').length;

  const actions = checklist
    .filter((item) => item.result !== 'Yes')
    .sort((a, b) => {
      const priority = { High: 0, Medium: 1, Low: 2 };
      const gap = { No: 0, Partly: 1 };
      return priority[a.priority] - priority[b.priority] || gap[a.result] - gap[b.result];
    })
    .map((item) => ({
      id: item.id,
      what_to_do: item.fix,
      weakness: item.label,
      effect: item.result === 'No' ? `Removes a ${item.priority.toLowerCase()} gap` : `Closes part of a ${item.priority.toLowerCase()} gap`,
      effort: item.effort,
      button: item.button,
    }));

  const explanation = [
    `Rated ${RATINGS[index]}. ${fullyMet} of ${checklist.length} checks fully met${partlyMet ? `, ${partlyMet} partly met` : ''}.`,
    ...notes,
    actions.length > 0 ? `Biggest next step: ${actions[0].what_to_do}` : 'No open gaps are recorded against this version.',
  ].join(' ');

  return { rating: RATINGS[index], explanation, checklist, actions };
}