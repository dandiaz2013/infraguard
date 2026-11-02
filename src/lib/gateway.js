// The seven gateway issues for an application to vary, revoke or reopen.
// Every line is taken from a verified record paragraph or a stored authority extract.
import { findAnswer, storedExtractFor } from '@/lib/evidence';
import { clip } from '@/lib/recordIndex';

const OUR_SIDE = ['Our side'];
const THEM = ['Other party', 'Court'];

function line(answer) {
  if (!answer) return null;
  return {
    document_name: answer.document_name,
    ref: answer.ref,
    quote: clip(answer.quote, 200),
    role: answer.role,
    category: answer.category
  };
}

function gapFor(ours, theirs) {
  if (!ours && !theirs) return 'Nothing in the record answers this either way.';
  if (ours && !theirs) return 'Our answer is in the record. Nothing in the record answers it for the other side.';
  if (!ours && theirs) return 'Their answer is in the record. We have no verified paragraph on it.';
  return 'Our answer and theirs are both in the record. The draft has to reconcile the two paragraphs.';
}

function rate(ours, theirs, authority, extra = '') {
  if (!ours) {
    return {
      rating: 'Weak',
      reason: `No verified record paragraph answers this.${authority ? ` The stored extract sets the test at paragraph ${authority.paragraph_ref || 'not recorded'}.` : ''}`
    };
  }
  if (ours.role === 'Court') {
    return { rating: 'Strong', reason: `The court's own words at ${ours.document_name}, ${ours.ref} answer it.` };
  }
  if (theirs) {
    return {
      rating: 'Arguable',
      reason: `${ours.document_name}, ${ours.ref} answers it for us, but ${theirs.document_name}, ${theirs.ref} answers it for them.`
    };
  }
  return { rating: extra ? 'Arguable' : 'Strong', reason: `${ours.document_name}, ${ours.ref} answers it and nothing answers it against us.` };
}

const EXTRACTS = {
  route: /jurisdiction|power to (vary|revoke|reopen)|set aside/i,
  gateway: /misstatement|mistake|change of circumstances|material change/i,
  materiality: /material|consequence|would have (made a )?difference|turned on/i,
  knowable: /known|knowable|aware|discovery|diligence/i,
  promptness: /prompt|delay|out of time|time limit/i,
  finality: /final|conclusive|abuse of process|res judicata/i,
  relief: /relief|set aside|vary|revoke|reopen/i
};

export function buildGateway({ record, extracts = [], promptness = null } = {}) {
  const authority = (id) => storedExtractFor(extracts, EXTRACTS[id]);
  const issues = [];

  // 1. Route and jurisdiction
  {
    const ours = line(
      findAnswer(record, {
        terms: ['set aside', 'vary', 'revoke', 'reopen', 'jurisdiction', 'cpr', 'rule', 'application'],
        roles: OUR_SIDE,
        minHits: 2
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['jurisdiction', 'no power', 'wrong route', 'should have appealed', 'permission to appeal'],
        roles: THEM,
        minHits: 1
      })
    );
    const ext = authority('route');
    const verdict = rate(ours, theirs, ext);
    issues.push({
      id: 'route',
      number: 1,
      title: 'Route and jurisdiction',
      ask: 'Which rule allows this application, in which court, and does anything in the record question it?',
      ours,
      theirs,
      gap: gapFor(ours, theirs),
      next: ours
        ? `Cite ${ours.document_name}, ${ours.ref} with the rule relied on.`
        : 'Add the paragraph of the application notice that states the rule and the court.',
      authority: ext,
      ...verdict
    });
  }

  // 2. Gateway: fact misstated, or change of circumstances
  {
    const ours = line(
      findAnswer(record, {
        terms: ['misstated', 'misstatement', 'mistake', 'wrong', 'incorrect', 'change of circumstances', 'new circumstances', 'material change'],
        roles: OUR_SIDE,
        minHits: 1
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['misstated', 'misstatement', 'no change', 'not material', 'unchanged', 'same circumstances'],
        roles: THEM,
        minHits: 1
      })
    );
    const ext = authority('gateway');
    issues.push({
      id: 'gateway',
      number: 2,
      title: 'Gateway: fact misstated, or change of circumstances',
      ask: 'Which gateway is relied on, and where in the record is the fact misstated or the change shown?',
      ours,
      theirs,
      gap: gapFor(ours, theirs),
      next: ours
        ? `Tie the gateway to ${ours.document_name}, ${ours.ref} and to the fact as it now stands.`
        : 'State the gateway and the paragraph that proves the misstatement or the change.',
      authority: ext,
      ...rate(ours, theirs, ext)
    });
  }

  // 3. Materiality: what the decision actually turned on, in the court's own paragraphs
  {
    const ours = line(
      findAnswer(record, {
        terms: ['turned on', 'material', 'made no difference', 'would have made no difference', 'decisive'],
        roles: OUR_SIDE,
        minHits: 1
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['turned on', 'decisive', 'consequence of', 'material', 'would have', 'the reason i'],
        roles: ['Court'],
        categories: ['Judgments', 'Orders'],
        minHits: 1
      })
    );
    const ext = authority('materiality');
    issues.push({
      id: 'materiality',
      number: 3,
      title: 'Materiality: what the decision turned on',
      ask: 'What did the decision actually turn on, in the court’s own paragraphs, and would the result have been different?',
      ours,
      theirs,
      gap: gapFor(ours, theirs),
      next: theirs
        ? `Quote the court at ${theirs.document_name}, ${theirs.ref} and show why the outcome would have differed.`
        : 'Add the court paragraph that shows what the decision turned on.',
      authority: ext,
      ...rate(ours, theirs, ext)
    });
  }

  // 4. Known or knowable
  {
    const ours = line(
      findAnswer(record, {
        terms: ['knew', 'known', 'know', 'aware', 'informed', 'notified', 'discovered', 'ought to have known', 'only learned'],
        roles: OUR_SIDE,
        minHits: 1
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['knew', 'known', 'aware', 'ought to have known', 'could have known'],
        roles: THEM,
        minHits: 1
      })
    );
    const ext = authority('knowable');
    issues.push({
      id: 'knowable',
      number: 4,
      title: 'Known or knowable',
      ask: 'When did each side know, or could each side have known, the point now relied on?',
      ours,
      theirs,
      gap: gapFor(ours, theirs),
      next: ours
        ? `Date the knowledge from ${ours.document_name}, ${ours.ref}.`
        : 'Add the paragraph that dates when the point became known.',
      authority: ext,
      ...rate(ours, theirs, ext)
    });
  }

  // 5. Promptness and explanation
  {
    const ours = line(
      findAnswer(record, {
        terms: ['delay', 'late', 'out of time', 'reason for', 'because', 'could not', 'unable', 'explain'],
        roles: OUR_SIDE,
        minHits: 2
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['out of time', 'delay', 'promptness', 'too late', 'promptly'],
        roles: THEM,
        minHits: 1
      })
    );
    const ext = authority('promptness');
    const measured = Boolean(promptness?.order?.date && promptness?.application?.date);
    const verdict = !measured
      ? { rating: 'Weak', reason: 'The record does not show both dates, so the interval cannot be measured.' }
      : rate(ours, theirs, ext, measured ? 'measured' : '');
    issues.push({
      id: 'promptness',
      number: 5,
      title: 'Promptness and explanation',
      ask: 'How long after the order was the application made, and what explains the interval?',
      ours,
      theirs,
      promptness,
      gap: !measured
        ? 'The order challenged and the application are not both dated in the record.'
        : ours
          ? gapFor(ours, theirs)
          : `The interval is ${promptness.interval}. Nothing in the record explains it.`,
      next: !measured
        ? 'Pick the order challenged and add the application notice with its date.'
        : ours
          ? `Explain the interval with ${ours.document_name}, ${ours.ref}.`
          : 'Add the paragraph that explains the interval, or accept the risk.',
      authority: ext,
      ...verdict
    });
  }

  // 6. Finality, and earlier appeals and refusals
  {
    const ours = line(
      findAnswer(record, {
        terms: ['final', 'appeal', 'permission to appeal', 'refused', 'dismissed'],
        roles: OUR_SIDE,
        minHits: 1
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['final', 'conclusive', 'no right of appeal', 'permission to appeal', 'refused permission', 'dismissed', 'res judicata'],
        roles: ['Court'],
        categories: ['Judgments', 'Orders'],
        minHits: 1
      })
    );
    const ext = authority('finality');
    issues.push({
      id: 'finality',
      number: 6,
      title: 'Finality, and earlier appeals and refusals',
      ask: 'Is the order final, and what earlier appeals or refusals does the record show?',
      ours,
      theirs,
      gap: gapFor(ours, theirs),
      next: theirs
        ? `Set out the earlier appeal or refusal at ${theirs.document_name}, ${theirs.ref} and answer finality.`
        : 'Add the order and any earlier refusal, with their paragraphs.',
      authority: ext,
      ...rate(ours, theirs, ext)
    });
  }

  // 7. Relief sought
  {
    const ours = line(
      findAnswer(record, {
        terms: ['set aside', 'vary', 'revoke', 'reopen', 'seek', 'apply for', 'order that', 'relief'],
        roles: OUR_SIDE,
        minHits: 1
      })
    );
    const theirs = line(
      findAnswer(record, {
        terms: ['oppose', 'resist', 'refuse', 'dismiss the application'],
        roles: ['Other party'],
        minHits: 1
      })
    );
    const ext = authority('relief');
    issues.push({
      id: 'relief',
      number: 7,
      title: 'Relief sought',
      ask: 'Exactly what order is asked for, and where is it stated in the record?',
      ours,
      theirs,
      gap: gapFor(ours, theirs),
      next: ours
        ? `State the relief in the words of ${ours.document_name}, ${ours.ref}.`
        : 'Add the part of the application notice that states the relief sought.',
      authority: ext,
      ...rate(ours, theirs, ext)
    });
  }

  return issues;
}

// The weakest issue sets the ceiling.
export function gatewayProspects(issues = []) {
  if (!issues.length) return { rating: 'Weak', explanation: 'No gateway issue could be assessed.', weakest: null };
  const order = { Weak: 0, Arguable: 1, Strong: 2 };
  const weakest = issues.reduce((worst, issue) => (order[issue.rating] < order[worst.rating] ? issue : worst), issues[0]);
  const counts = issues.reduce((acc, issue) => ({ ...acc, [issue.rating]: (acc[issue.rating] || 0) + 1 }), {});
  const rating = issues.some((issue) => issue.rating === 'Weak')
    ? 'Weak'
    : issues.some((issue) => issue.rating === 'Arguable')
      ? 'Arguable'
      : 'Strong';
  const explanation = `Rated ${rating}: the weakest gateway issue sets the ceiling. ${weakest.title} is ${weakest.rating.toLowerCase()} — ${weakest.reason} ${
    counts.Strong ? `${counts.Strong} issue${counts.Strong === 1 ? '' : 's'} rated strong. ` : ''
  }${counts.Arguable ? `${counts.Arguable} arguable. ` : ''}${counts.Weak ? `${counts.Weak} weak.` : ''}`.trim();
  return { rating, explanation, weakest };
}