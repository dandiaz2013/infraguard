// Proposed approaches for each gateway issue, taken from the record and the stored
// checked extracts. Deterministic: every support is a real passage or extract, never
// a suggestion invented by a model. The rating itself comes from issueRating.
import { APPROACHES, rateIssue, raise, rankOf, RATINGS } from '@/lib/issueRating';
import { recordEvidenceFor } from '@/lib/issueRating';

const BY_ISSUE = {
  route: [
    {
      id: 'rule-route',
      label: 'The rule relied on allows this application in this court',
      needs: 'The paragraph of the application notice naming the rule and the court.',
      risk: 'If the rule does not cover the order challenged, the court may say the route is wrong and no appeal follows.',
    },
    {
      id: 'inherent',
      label: 'The court has power to correct its own order',
      needs: 'An order or judgment of this court that corrected its own order on the same basis.',
      risk: 'The court may prefer the view that the only route is an appeal.',
    },
  ],
  gateway: [
    ...APPROACHES,
    {
      id: 'never-put',
      label: 'The point was never put to the court',
      needs: 'A passage of the order or judgment showing the point was not addressed.',
      risk: 'A point not put is not the same as a fact misstated.',
    },
  ],
  materiality: [
    {
      id: 'outcome-different',
      label: 'The outcome would have been different',
      needs: 'The court paragraph that shows what the decision turned on.',
      risk: 'The court may find the decision turned on something else entirely.',
    },
    {
      id: 'never-argued',
      label: 'The decision turned on a point never argued',
      needs: 'The judgment paragraph deciding the point, and a record passage showing it was never raised.',
      risk: 'The other side may show the point was raised in correspondence.',
    },
  ],
  knowable: [
    {
      id: 'not-knowable',
      label: 'The point was not knowable earlier',
      needs: 'A dated document showing when the fact first became available.',
      risk: 'The court may find the fact was knowable from the documents we already had.',
    },
    {
      id: 'diligence',
      label: 'Reasonable diligence was used once the point was known',
      needs: 'The date the point was discovered and the date the application was issued.',
      risk: 'Time spent after discovery still counts against us.',
    },
  ],
  promptness: [
    {
      id: 'interval-explained',
      label: 'The interval is explained by the record',
      needs: 'The paragraph that explains the interval, with its date.',
      risk: 'The court weighs promptness on all the circumstances and may not accept the explanation.',
    },
    {
      id: 'prejudice',
      label: 'The delay causes no prejudice to the other side',
      needs: 'The relief sought and the position of the other side on prejudice.',
      risk: 'Prejudice is only part of the test; delay can be enough on its own.',
    },
    ...APPROACHES.filter((entry) => entry.id === 'change'),
  ],
  finality: [
    {
      id: 'no-earlier-refusal',
      label: 'There has been no earlier appeal or refusal on this point',
      needs: 'The procedural history from the record, including any refusal of permission.',
      risk: 'A refusal of permission to appeal is a high hurdle to overcome.',
    },
    {
      id: 'finality-yields',
      label: 'Finality gives way because the order rests on a misstatement',
      needs: 'The order paragraph that rests on the fact said to be misstated.',
      risk: 'The court may treat finality as decisive where the order is otherwise regular.',
    },
  ],
  relief: [
    {
      id: 'set-aside',
      label: 'Set the order aside and remit the application',
      needs: 'The relief stated in the application notice, in its own words.',
      risk: 'A set-aside reopens the whole application, including the points we lost on.',
    },
    {
      id: 'vary-limited',
      label: 'Vary the order in limited terms',
      needs: 'The precise terms proposed, tied to the record.',
      risk: 'A narrower order may not give the client what they actually need.',
    },
  ],
};

export function approachesFor(issue = {}, record = {}, extracts = []) {
  const list = BY_ISSUE[issue.id] || APPROACHES;
  const evidence = recordEvidenceFor(issue, record);
  const checked = extracts || [];

  return list.map((approach) => {
    const supports = [];
    const passage = evidence.fromCourtOrOther[0];
    if (passage) {
      supports.push(`${passage.document_name}, ${passage.ref}: “${String(passage.text).slice(0, 160)}”`);
    }
    if (evidence.fromOurs[0]) {
      supports.push(
        `Our own statement at ${evidence.fromOurs[0].document_name}, ${evidence.fromOurs[0].ref} (our position, not evidence).`
      );
    }
    if (checked[0]) {
      supports.push(
        `Stored extract at paragraph ${checked[0].paragraph_ref || 'not recorded'}: ${checked[0].proposition || String(checked[0].extract_text || '').slice(0, 120)}`
      );
    }
    if (!supports.length) supports.push('Nothing in the record supports this approach yet.');
    return { ...approach, supports };
  });
}

export function approachById(issue, id) {
  const list = BY_ISSUE[issue?.id] || APPROACHES;
  return list.find((entry) => entry.id === id) || null;
}

// Ratings for one issue. Evidence never moves because of anything the user wrote;
// only Argument does.
export function rateApproach({
  issue = {},
  approachIds = [],
  ownApproach = '',
  explanation = '',
  source = {},
  record = {},
  extracts = [],
  previous = null,
} = {}) {
  const chosen = approachIds.map((id) => approachById(issue, id)).filter(Boolean);
  const chosenLabel = ownApproach
    ? 'Your own approach'
    : chosen.map((entry) => entry.label).join(' + ') || '';
  const approach = chosenLabel ? { id: ownApproach ? 'own' : chosen[0].id, label: chosenLabel } : null;

  const rated = rateIssue({
    issue,
    approach,
    explanation,
    explanationRef: source,
    record,
    extracts,
    previous,
  });

  if (chosen.length > 1 && rankOf(rated.argument.rating) < rankOf('Strong')) {
    rated.argument.rating = raise(rated.argument.rating);
    rated.argument.reasons.unshift(`Approaches combined: ${chosen.map((entry) => entry.label).join(' + ')}.`);
  }

  return {
    ...rated,
    approach,
    approachIds,
    ownApproach,
    evidence: { ...rated.evidence, rating: RATINGS[rankOf(rated.evidence.rating)] },
  };
}

export function changeLine(change = {}) {
  return `${change.dimension}: ${change.before} → ${change.after} — ${change.reason}`;
}

// The per-issue ratings, in the order the gateway lists them.
export function ratingMap(rates = []) {
  const map = {};
  rates.forEach((entry) => {
    if (entry?.issue_id) map[entry.issue_id] = entry;
  });
  return map;
}