// Deterministic prospects checklist. No AI, no percentage, no prediction of outcome.
import { normalise } from '@/lib/authorityCheck';
import { buildChronology } from '@/lib/chronology';
import { isExtractChecked } from '@/lib/extractStatus';

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
  legalTests = [],
  gap = null,
  record = null,
} = {}) {
  const draft = String(text || '');

  const recordNames = (record?.documents || []).map((doc) => doc.name).filter(Boolean);
  const recordNorm = record?.text ? normalise(record.text) : '';

  const inRecord = (name) => {
    if (recordNames.length === 0) return true;
    const target = normalise(name);
    if (!target) return false;
    return recordNames.some((entry) => {
      const other = normalise(entry);
      return Boolean(other) && (other.includes(target) || target.includes(other));
    });
  };

  const clauseInRecord = (clause) => {
    if (!recordNorm) return true;
    const value = normalise(clause.text);
    return Boolean(value) && recordNorm.includes(value);
  };
  const checklist = [];

  const checkedExtracts = extracts.filter((extract) =>
    isExtractChecked(extract, caseLaw.find((entry) => entry.id === extract.case_law_id))
  );
  const confirmedTestsNow = (legalTests || []).filter((test) => test.status === 'Confirmed by user');
  const testsFromChecked = confirmedTestsNow.filter(
    (test) =>
      (test.elements || []).length > 0 &&
      (test.elements || []).every(
        (element) =>
          element.source_extract_id && checkedExtracts.some((extract) => extract.id === element.source_extract_id)
      )
  );

  // 1. Legal test built from checked extracts
  const authorityToFind =
    caseLaw.find(
      (record) =>
        record.is_main === true && !checkedExtracts.some((extract) => extract.case_law_id === record.id)
    ) || caseLaw.find((record) => record.is_main === true);
  const findLabel = authorityToFind ? `Find the test in ${authorityToFind.name}` : 'Find the test in the authority';

  checklist.push({
    ...makeItem(
      'legal_test',
      'Legal test built from extracts checked against the official text',
      'High',
      testsFromChecked.length > 0 ? 'Yes' : confirmedTestsNow.length > 0 ? 'Partly' : 'No',
      testsFromChecked.length > 0
        ? `“${testsFromChecked[0].name}” is built from ${checkedExtracts.length} checked extract${checkedExtracts.length === 1 ? '' : 's'}.`
        : confirmedTestsNow.length > 0
          ? 'A confirmed test exists, but not every element is linked to an extract checked against the official text.'
          : 'No confirmed legal test is built from checked extracts for this matter.',
      `${findLabel}, tick each extract you compared with the official text, then confirm the elements.`,
      'Medium',
      'find_test'
    ),
    button_label: findLabel,
    find_authority: authorityToFind?.name || '',
  });

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
  const pointsWithReference = ourPoints.filter((point) => hasReference(point) && inRecord(point.document_name));
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
  const checkedClauses = clauses.filter((clause) => clause.checked && clauseInRecord(clause));
  const uncheckedClauses = clauses.filter((clause) => !checkedClauses.includes(clause));
  checklist.push(
    makeItem(
      'clauses',
      'Contract clauses / rules relied on are stored and checked',
      'Medium',
      clauses.length === 0 ? 'No' : uncheckedClauses.length === 0 ? 'Yes' : 'Partly',
      clauses.length === 0
        ? 'No contract clause or rule has been stored.'
        : `${clauses.length} stored, ${uncheckedClauses.length} not yet checked against the record or the official text.`,
      'Store the clause text and confirm it word for word.',
      'Low',
      'clause'
    )
  );

  // 7. Misstatements supported by evidence
  const unsupportedMisstatements = misstatements.filter((entry) => !entry.document_name || !inRecord(entry.document_name));
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

  // 10. Legal test confirmed with its elements
  const confirmedTests = (legalTests || []).filter((test) => test.status === 'Confirmed by user');
  const testElements = confirmedTests.flatMap((test) => test.elements || []);
  const confirmedElements = testElements.filter((element) => element.user_confirmed);
  checklist.push(
    makeItem(
      'legal_test_confirmed',
      'Confirmed legal test with its elements recorded',
      'High',
      confirmedTests.length === 0
        ? 'No'
        : testElements.length > 0 && confirmedElements.length === testElements.length
          ? 'Yes'
          : 'Partly',
      confirmedTests.length === 0
        ? 'No legal test has been confirmed for this matter.'
        : `${confirmedTests.length} confirmed test${confirmedTests.length === 1 ? '' : 's'}, ${confirmedElements.length} of ${testElements.length} element${testElements.length === 1 ? '' : 's'} confirmed.`,
      'Confirm the legal test and each of its elements from the stored extracts.',
      'Medium',
      'test'
    )
  );

  // 11. Each element of the confirmed test covered by our evidence
  const elementCounts = gap?.summary || {};
  const totalElements = Number(elementCounts.total || 0);
  const coveredElements = Number(elementCounts.covered || 0);
  const partlyElements = Number(elementCounts.partly || 0);
  const notCoveredElements = Number(elementCounts.not_covered || 0);
  const uncoveredElement = (gap?.element_results || []).find((row) => row.status === 'Not covered');
  const elementRows = gap?.element_results || [];
  const elementLines = elementRows
    .slice(0, 14)
    .map(
      (row) =>
        `${row.test_name ? `${row.test_name} ` : ''}Element ${row.element_number}: ${row.status}${row.missing ? ` — ${row.missing}` : ''}`
    );
  const uncoveredRows = elementRows.filter((row) => row.status !== 'Covered').slice(0, 2);
  const gapFixes = uncoveredRows.map(
    (row) =>
      `${row.test_name ? `${row.test_name} ` : ''}element ${row.element_number}: ${row.missing || row.bridge || 'add the fact and the record paragraph that proves it'}`
  );

  checklist.push({
    ...makeItem(
      'elements_covered',
      'Each element of the confirmed test covered by our evidence',
      'High',
      !gap || totalElements === 0
        ? 'No'
        : coveredElements === totalElements
          ? 'Yes'
          : coveredElements + partlyElements > 0
            ? 'Partly'
            : 'No',
      !gap
        ? 'No witness statement gap analysis has been run for this matter.'
        : `${coveredElements} covered, ${partlyElements} partly covered, ${notCoveredElements} not covered (${totalElements} element${totalElements === 1 ? '' : 's'}).`,
      gapFixes.length > 0
        ? `Cover each open element with a record paragraph or a new fact: ${gapFixes.join('; ')}.`
        : uncoveredElement
          ? `Add facts on element ${uncoveredElement.element_number}${uncoveredElement.test_name ? ` of ${uncoveredElement.test_name}` : ''} to a supplementary statement.`
          : 'Run the witness statement gap analysis, then add the missing facts to a supplementary statement.',
      'Medium',
      'factlist'
    ),
    details: elementLines,
  });

  // 12. Promptness
  const chronology = record ? buildChronology(record) : null;
  const delay = chronology?.delay || null;
  const delayExplanation = delay
    ? (record?.segments || []).find(
        (segment) =>
          /(delay|late|out of time|prompt)/i.test(segment.text) &&
          /(explain|reason|because|due to|could not|unable|advised)/i.test(segment.text) &&
          !(segment.document_name === delay.order.document_name && segment.ref === delay.order.ref)
      )
    : null;

  checklist.push({
    ...makeItem(
      'promptness',
      'Promptness: the interval between the order and the application, and the explanation for it',
      'High',
      !delay ? 'No' : delay.flagged ? (delayExplanation ? 'Partly' : 'No') : 'Yes',
      !delay
        ? 'The record does not show both the date of the order and the date of the application, so the interval cannot be measured.'
        : `${delay.note}${delayExplanation ? ` The record also says: “${String(delayExplanation.text).slice(0, 160)}” (${delayExplanation.document_name}, ${delayExplanation.ref}).` : ' No explanation for the interval is recorded.'}`,
      !delay
        ? 'Record the date of the order and the date of the application, each with its document and paragraph.'
        : delay.flagged && !delayExplanation
          ? `Explain the ${delay.days} days between ${delay.order.document_name}, ${delay.order.ref} and ${delay.application.document_name}, ${delay.application.ref}: add the reason with the record paragraph that proves it.`
          : `Keep the explanation tied to the record: ${delayExplanation ? `${delayExplanation.document_name}, ${delayExplanation.ref}` : 'add the paragraph that explains the interval'}.`,
      'Medium',
      'question'
    ),
    details: (chronology?.entries || [])
      .slice(0, 8)
      .map((entry) => `${entry.stated_as || entry.date} — ${entry.quote.slice(0, 90)} (${entry.document_name}, ${entry.ref})`),
  });

  // 13. Known or knowable
  const knowledgeSegments = (record?.segments || []).filter(
    (segment) =>
      /(knew|known|know|became aware|was aware|informed|notified|ought to have known)/i.test(segment.text) &&
      /\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
        segment.text
      )
  );
  const knowledge = knowledgeSegments[0] || null;

  checklist.push(
    makeItem(
      'knowable',
      'Known or knowable: what the record shows about when each side knew or could have known the point',
      'High',
      knowledge ? 'Yes' : 'No',
      knowledge
        ? `The record dates that knowledge: “${String(knowledge.text).slice(0, 160)}” (${knowledge.document_name}, ${knowledge.ref}).`
        : 'Nothing in the record dates when either side knew or could have known the point.',
      knowledge
        ? `Tie the answer to that paragraph (${knowledge.document_name}, ${knowledge.ref}) and to any later paragraph showing what changed.`
        : 'Add the record paragraph that dates each side’s knowledge, or the new fact that does.',
      'Medium',
      'document'
    )
  );

  // 14. Finality of the order challenged
  const finalitySegment = (record?.segments || []).find((segment) =>
    /(final (order|judgment|judgement|decision|determination)|final and conclusive|no right of appeal|conclusive)/i.test(
      segment.text
    )
  );

  checklist.push(
    makeItem(
      'finality',
      'Finality: whether the order challenged is final, with the record reference',
      'High',
      finalitySegment ? 'Yes' : 'No',
      finalitySegment
        ? `The record shows the order treated as final: “${String(finalitySegment.text).slice(0, 160)}” (${finalitySegment.document_name}, ${finalitySegment.ref}).`
        : 'Nothing in the record states that the order challenged is final.',
      finalitySegment
        ? `Cite ${finalitySegment.document_name}, ${finalitySegment.ref} wherever finality is relied on.`
        : 'Show from the order, and the rule you rely on, that the order is final, and cite the paragraph.',
      'Low',
      'document'
    )
  );

  // 15. Route relied on, and any other route the other side raises
  const otherRoute = (record?.segments || []).find(
    (segment) =>
      segment.role === 'Other party' &&
      /(appeal|permission to appeal|judicial review|set aside|vary|reconsider|review)/i.test(segment.text)
  );

  checklist.push(
    makeItem(
      'route',
      'Route: the rule relied on, and any other route the other side raises, with record references',
      'High',
      !procedural?.route_confirmed ? 'No' : otherRoute ? 'Partly' : 'Yes',
      !procedural?.route_confirmed
        ? 'The route relied on has not been confirmed from the documents.'
        : otherRoute
          ? `The other side raise another route: “${String(otherRoute.text).slice(0, 160)}” (${otherRoute.document_name}, ${otherRoute.ref}).`
          : 'The route relied on is confirmed and no other route is raised in the record.',
      otherRoute
        ? `Answer the other route raised at ${otherRoute.document_name}, ${otherRoute.ref}, and cite the rule relied on.`
        : 'Confirm the rule relied on and cite it, with the record paragraph for the order challenged.',
      'Medium',
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

  if (confirmedTests.length === 0 && index > 1) {
    index = 1;
    notes.push('Without a confirmed legal test the rating is capped at Arguable.');
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
      button_label: item.button_label || '',
    }));

  const explanation = [
    `Rated ${RATINGS[index]}. ${fullyMet} of ${checklist.length} checks fully met${partlyMet ? `, ${partlyMet} partly met` : ''}.`,
    ...notes,
    actions.length > 0 ? `Biggest next step: ${actions[0].what_to_do}` : 'No open gaps are recorded against this version.',
  ].join(' ');

  return { rating: RATINGS[index], explanation, checklist, actions };
}