// The register. One plain-English list of every risk and gap in the matter, each taken
// through the same loop: how the system reads it, what the record says, one yes/no
// question, how to resolve it, and the result. Deterministic throughout.
import { normalise } from '@/lib/authorityCheck';
import { LAW_KINDS, ROLE_LABELS, clip, datesIn, quoteInText } from '@/lib/recordIndex';
import { keyTerms, searchRecord } from '@/lib/recordFirst';
import { authorityLabel } from '@/lib/authorityNaming';

const CUE =
  /\b(i find|i hold|i am satisfied|in my judgment|in my view|it follows|the court (holds|finds|considers|is satisfied)|ordered that|it is ordered|must|requires?|shall|agreed|accepted|admitted|stated|says|said|denies|contends|provides?)\b/i;

const IN_FORCE = /\b(in force|not in force|came into force|commencement|repealed|revoked|replaced|superseded|regime|substituted)\b/i;

const OPPOSITION = [
  {
    id: '5230',
    topic: 'CPR 52.30',
    re: /\b52\.30\b/,
    severity: 'High',
    why: 'Re-opening a final judgment is a rare route. If it is raised, the argument has to meet it head on.',
    query: '52.30 re-opening final judgment exceptional circumstances',
  },
  {
    id: 'finality',
    topic: 'finality',
    re: /\b(finality|final (judgment|order)|conclusive)\b/i,
    severity: 'High',
    why: 'Finality is the other side’s strongest answer to a re-opening application.',
    query: 'finality final judgment conclusive',
  },
  {
    id: 'relitigation',
    topic: 're-litigation',
    re: /\b(re-?litigat\w*|res judicata|abuse of process)\b/i,
    severity: 'High',
    why: 'If the point was decided before, the argument must say why it is not re-arguing it.',
    query: 're-litigation res judicata abuse of process already decided',
  },
  {
    id: 'delay',
    topic: 'delay',
    re: /\b(delay|out of time|promptness|late application|time limit)\b/i,
    severity: 'High',
    why: 'Delay is answered with dates, not adjectives. The record has to show the interval.',
    query: 'delay promptness time limit permission application',
  },
  {
    id: 'newpoint',
    topic: 'a new point',
    re: /\b(new point|not raised below|point not taken)\b/i,
    severity: 'Medium',
    why: 'A point not taken below needs the record to show where it was raised.',
    query: 'new point not raised below argued previously',
  },
];

const TYPE_WEIGHT = {
  missing_document: 0,
  opposition: 1,
  contradiction: 2,
  test_element: 3,
  law_date: 4,
  attribution: 5,
  position: 6,
  proposal: 7,
  checklist: 8,
};

const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2 };

function slug(value) {
  return normalise(value).replace(/\s+/g, '-').slice(0, 40) || 'item';
}

function judge(match, terms, answerRoles) {
  if (answerRoles && !answerRoles.includes(match.role)) return null;
  const norm = normalise(match.text);
  const covered = terms.filter((term) => norm.includes(term.length >= 6 ? term.slice(0, 5) : term));
  const coverage = terms.length ? covered.length / terms.length : 0;
  const dates = datesIn(match.text);
  const cue = CUE.test(match.text)
    ? 'takes a position on it'
    : dates.length
      ? `gives the date ${dates[0]}`
      : '';
  const answers = Boolean(coverage >= 0.55 && cue && quoteInText(match.quote, match.text));
  return {
    answers,
    coverage,
    because: answers ? `answers because it covers ${covered.slice(0, 3).join(', ')} and ${cue}` : '',
  };
}

export function recordAnswers(record, query, answerRoles) {
  const terms = keyTerms(query);
  const searched = (record?.documents || []).map((doc) => doc.name);
  if (!record || terms.length === 0) return { answering: [], searched, discarded: 0 };

  const { matches } = searchRecord(record, query, 8);
  const judged = matches
    .map((match) => ({ match, verdict: judge(match, terms, answerRoles) }))
    .filter((entry) => entry.verdict);

  const answering = judged
    .filter((entry) => entry.verdict.answers && entry.match.verified)
    .slice(0, 3)
    .map((entry) => ({
      document_name: entry.match.document_name,
      ref: entry.match.ref,
      role: entry.match.role,
      role_label: ROLE_LABELS[entry.match.role] || entry.match.role,
      quote: clip(entry.match.quote, 320),
      verified: true,
      because: entry.verdict.because,
    }));

  const candidates = matches
    .filter((match) => match.verified)
    .slice(0, 5)
    .map((match) => ({
      document_name: match.document_name,
      ref: match.ref,
      quote: clip(match.quote, 260),
    }));

  return { answering, candidates, searched, discarded: judged.length - answering.length };
}

function stepsFor(item) {
  const steps = [];
  if (item.type === 'missing_document') {
    steps.push({ label: `Upload ${item.blocked_by}`, action: 'upload' });
  }
  if (item.type === 'attribution') {
    steps.push({ label: 'Correct the citation', action: 'fixcitation' });
  }
  if (item.type === 'proposal') {
    steps.push({ label: 'Use the text built from the record', action: 'useproposal' });
  }
  if (item.type === 'law_date') {
    steps.push({ label: 'Paste the provision text, commencement and source', action: 'official' });
  }
  steps.push({ label: 'Point the system at the paragraph', action: 'paste' });
  if (item.type !== 'missing_document' && item.type !== 'attribution') {
    steps.push({ label: 'Ask counsel to advise', action: 'counsel' });
  }
  steps.push({ label: 'Accept the risk as it stands', action: 'accept' });
  return steps.slice(0, 4);
}

function resolve(item, answer) {
  const answering = item.record.answering || [];
  const supported = answering[0];
  const base = { original: item.title, evidence: answering, status: 'Open', remaining: 'Unchanged', reason: '' };

  if (item.type === 'law_date') {
    const stored = Boolean(answer?.provision_text);
    const compared = Boolean(answer?.compared_confirmed);
    base.status = stored && compared ? 'Answered by you' : 'Needs official text';
    base.remaining = stored && compared ? 'Reduced' : 'Unchanged';
    base.reason = stored
      ? compared
        ? 'Officially sourced text, commencement and any revocation are stored and you have compared them with the official source. The record alone cannot establish the law.'
        : 'Provision text is stored. Tick that you compared it with the official source before it is relied on.'
      : 'Needs official text: the record cannot tell you whether this provision was in force on the date relied on.';
    return base;
  }

  if (item.blocked_by) {
    base.status = `Blocked: upload ${item.blocked_by}`;
    base.reason = `Blocked: upload ${item.blocked_by}`;
    return base;
  }

  if (supported && supported.verified) {
    base.status = 'Answered from record';
    base.remaining = 'Closed';
    base.reason = `Closed because ${supported.document_name}, ${supported.ref} answers it: “${clip(supported.quote, 160)}”`;
    return base;
  }

  if (answer?.accepted) {
    base.status = 'Accepted risk';
    base.reason = 'Accepted as it stands. No verified record quotation answers this.';
    return base;
  }

  if (answer?.answer) {
    base.status = 'Answered by you - not supported by the record';
    base.reason = 'Your answer is recorded, but no verified record quotation answers this, so the risk stays as it was.';
    return base;
  }

  base.reason = item.type === 'proposal'
    ? 'Confirm or correct the proposed text.'
    : 'No answer in the record yet.';
  return base;
}

// Find the user's own reference: either the document and paragraph they point to, or the
// text they paste. Returns null when it is not in the record, so nothing is accepted silently.
export function locateInRecord(record, { documentName = '', ref = '', text = '' } = {}) {
  const documents = record?.documents || [];
  if (documents.length === 0) return null;
  const pasted = normalise(text).slice(0, 120);

  if (pasted.length >= 15) {
    for (const doc of documents) {
      const hit = (doc.segments || []).find((segment) => normalise(segment.text).includes(pasted));
      if (hit) {
        return { document_name: doc.name, ref: hit.ref, quote: clip(hit.text, 320), verified: true, how: 'text' };
      }
    }
    return null;
  }

  const wantedDoc = normalise(documentName).replace(/\.[a-z0-9]{2,5}$/i, '');
  const doc = documents.find((entry) => {
    const name = normalise(String(entry.name).replace(/\.[a-z0-9]{2,5}$/i, ''));
    return wantedDoc.length > 2 && (name.includes(wantedDoc) || wantedDoc.includes(name));
  });
  if (!doc) return null;

  const wantedRef = normalise(ref).replace(/\s+/g, '');
  const segment = (doc.segments || []).find((entry) => {
    const value = normalise(entry.ref).replace(/\s+/g, '');
    return wantedRef.length > 0 && (value === wantedRef || value.includes(wantedRef) || wantedRef.includes(value));
  });
  if (!segment) return null;

  return { document_name: doc.name, ref: segment.ref, quote: clip(segment.text, 320), verified: true, how: 'reference' };
}

export function buildRegister({
  checklist = [],
  record = null,
  tests = [],
  missingDocs = [],
  positionNotes = [],
  proposals = [],
  citations = [],
  chronology = null,
  answers = {},
} = {}) {
  const items = [];
  const add = (item) => items.push({ ...item, steps: stepsFor(item) });

  (checklist || []).forEach((item) => {
    add({
      id: `check-${item.id}`,
      type: 'checklist',
      severity: item.priority === 'High' ? 'High' : item.priority === 'Low' ? 'Low' : 'Medium',
      title:
        item.result === 'No'
          ? `${item.label} - nothing in this version answers this`
          : item.result === 'Partly'
            ? `${item.label} - only partly answered`
            : `${item.label} - recorded as met, but no record reference has been shown`,
      why: item.reason || 'The prospects checklist treats this as necessary before the argument is court ready.',
      affects: 'The argument as a whole',
      question: `Does the record contain the material that answers "${clip(item.label, 90)}"?`,
      understanding: {
        text: `The evidence for this has not been shown from the record yet: ${item.label}.`,
        source: `Prospects checklist${item.result ? `, currently ${item.result}` : ''}`,
      },
      query: `${item.label} ${item.fix || ''}`,
      answerRoles: null,
      blocked_by: '',
    });
  });

  OPPOSITION.forEach((spec) => {
    if (spec.id === 'delay' && chronology?.delay?.flagged) return;
    const hit = (record?.segments || []).find(
      (segment) => spec.re.test(segment.text) && (segment.role === 'Other party' || segment.role === 'Court')
    );
    if (!hit) return;
    add({
      id: `opp-${spec.id}`,
      type: 'opposition',
      severity: spec.severity,
      title: `The ${spec.topic} point is raised against this application`,
      why: spec.why,
      affects: 'Counter-arguments and rebuttal',
      question: `Does the record show our answer to the ${spec.topic} point?`,
      understanding: {
        text: `${ROLE_LABELS[hit.role] || hit.role} raise ${spec.topic} at ${hit.document_name}, ${hit.ref}: “${clip(hit.text, 180)}”. Unless the record answers it, the argument is open on this point.`,
        source: `${hit.document_name}, ${hit.ref}`,
      },
      query: spec.query,
      answerRoles: ['Court', 'Our side'],
      blocked_by: '',
    });
  });

  const dated = (record?.segments || []).filter((segment) => segment.role !== 'Unknown' && datesIn(segment.text).length > 0);
  let conflicts = 0;
  for (let i = 0; i < dated.length && conflicts < 3; i += 1) {
    for (let j = i + 1; j < dated.length && conflicts < 3; j += 1) {
      const left = dated[i];
      const right = dated[j];
      if (left.role === right.role) continue;
      const shared = keyTerms(left.text).filter((term) => (right.norm || normalise(right.text)).includes(term.length >= 6 ? term.slice(0, 5) : term));
      if (shared.length < 2) continue;
      const leftDates = datesIn(left.text);
      const rightDates = datesIn(right.text);
      if (leftDates.some((date) => rightDates.includes(date))) continue;
      conflicts += 1;
      add({
        id: `conflict-${conflicts}`,
        type: 'contradiction',
        severity: 'High',
        title: `The record contains two versions of the ${shared.slice(0, 2).join(' / ')} position`,
        why: 'Where the parties differ on the same point, the argument has to say which version the court should take and why.',
        affects: 'Factual matrix and chronology',
        question: `Does the record settle which version of the ${shared[0]} position is right?`,
        understanding: {
          text: `${ROLE_LABELS[left.role]} say ${leftDates.join(', ')} at ${left.document_name}, ${left.ref}, while ${ROLE_LABELS[right.role]} say ${rightDates.join(', ')} at ${right.document_name}, ${right.ref}.`,
          source: `${left.document_name}, ${left.ref}; ${right.document_name}, ${right.ref}`,
        },
        query: shared.join(' '),
        answerRoles: ['Court'],
        blocked_by: '',
      });
    }
  }

  (missingDocs || []).slice(0, 8).forEach((doc) => {
    add({
      id: doc.id,
      type: 'missing_document',
      severity: 'High',
      title: `The record refers to ${doc.label} but it has not been uploaded`,
      why: 'Anything that depends on this document cannot be put to the court until it is in the record.',
      affects: 'Evidence and exhibits',
      question: `Do you have ${doc.label} to upload?`,
      understanding: {
        text: `${doc.who_label} refers to ${doc.label} at ${doc.document_name}, ${doc.ref}: “${clip(doc.quote, 160)}”. It is not in the uploaded record.`,
        source: `${doc.document_name}, ${doc.ref}`,
      },
      query: '',
      answerRoles: null,
      blocked_by: doc.label,
    });
  });

  (tests || [])
    .filter((test) => test.status === 'Confirmed by user')
    .forEach((test) => {
      (test.elements || []).forEach((element, index) => {
        const probe = recordAnswers(record, element.text || '', null);
        if (probe.answering.length > 0) return;
        add({
          id: `test-${test.id}-${index + 1}`,
          type: 'test_element',
          severity: 'High',
          title: `No record evidence for element ${index + 1} of ${test.name}`,
          why: 'Every element of a confirmed test has to be proved from the record before the argument can succeed on it.',
          affects: `Element ${index + 1} of the ${test.name} test`,
          question: `Does the record prove element ${index + 1}: "${clip(element.text, 100)}"?`,
          understanding: {
            text: `Element ${index + 1} of the confirmed test is: “${clip(element.text, 200)}”. Nothing in the record currently answers it.`,
            source: element.source_document_name
              ? `${test.name}; element taken from ${element.source_document_name}, ${element.source_paragraph_ref || 'reference not recorded'}`
              : `${test.name} (confirmed test)`,
          },
          query: element.text || test.name,
          answerRoles: null,
          blocked_by: '',
        });
      });
    });

  // One authority, one record: the year is part of the name, never a separate authority.
  const lawGroups = new Map();
  (record?.items || [])
    .filter((item) => LAW_KINDS.includes(item.kind))
    .forEach((item) => {
      const label = authorityLabel(item.label);
      const years = label.match(/\b(?:19|20)\d{2}\b/g) || [];
      const base = label.replace(/\s+(?:19|20)\d{2}\b/g, '').trim();
      const key = normalise(base);
      if (!lawGroups.has(key)) lawGroups.set(key, { base, years: new Set(), statements: [] });
      const group = lawGroups.get(key);
      years.forEach((year) => group.years.add(year));
      group.statements.push(item);
    });

  lawGroups.forEach((group) => {
    const dates = [...new Set(group.statements.flatMap((statement) => datesIn(statement.segment_text || '')))];
    const roles = new Set(group.statements.map((statement) => statement.role));
    const talksAboutForce = group.statements.some((statement) => IN_FORCE.test(statement.segment_text || ''));
    const years = [...group.years].sort();
    if (!(dates.length > 1 || years.length > 1 || (talksAboutForce && roles.size > 1))) return;
    const shown = years.length ? `${group.base} ${years.join('/')}` : group.base;
    add({
      id: `law-${slug(group.base)}`,
      type: 'law_date',
      severity: 'High',
      title: `Whether ${shown} was in force, and in what form, on the date relied on`,
      why: 'A filed document proves what was said, not what the law is. This can only be answered from the official text.',
      affects: 'Legal framework',
      question: `Was ${shown} in force on ${dates[0] || 'the date relied on'}?`,
      understanding: {
        text: `The record refers to ${shown} with different years, or with talk of a later regime: ${[...years, ...dates].join(', ') || 'no dates'}. The record cannot settle this.`,
        source: group.statements.map((statement) => `${statement.document_name}, ${statement.ref}`).slice(0, 3).join('; '),
      },
      query: `${shown} in force commencement`,
      answerRoles: null,
      blocked_by: '',
      law: { label: shown, dates },
    });
  });

  (positionNotes || []).forEach((text, index) => {
    add({
      id: `position-${index}`,
      type: 'position',
      severity: 'Medium',
      title: `"${clip(text, 70)}" is your position, not an undisputed fact`,
      why: 'An argument or objection stored as a fact will be read as agreed, and will not stand if it is challenged.',
      affects: 'Statement of facts',
      question: `Is "${clip(text, 80)}" an argument rather than an undisputed fact?`,
      understanding: {
        text: `You typed this under undisputed facts: “${clip(text, 160)}”. It reads as an argument or an objection about the other side, so it is stored as our position and needs a document reference.`,
        source: 'Your entry under Undisputed facts',
      },
      query: clip(text, 160),
      answerRoles: ['Court', 'Our side'],
      blocked_by: '',
    });
  });

  if (chronology?.delay?.flagged) {
    add({
      id: 'delay-interval',
      type: 'opposition',
      severity: 'High',
      title: `The interval between the order challenged and the application is ${chronology.delay.days} days`,
      why: 'Promptness is decided on the dates, so the argument has to explain the interval, not describe it.',
      affects: 'Procedural history and promptness',
      question: 'Does the record explain why the application came outside the promptness period?',
      understanding: {
        text: chronology.delay.note,
        source: `${chronology.delay.order.document_name}, ${chronology.delay.order.ref}; ${chronology.delay.application.document_name}, ${chronology.delay.application.ref}`,
      },
      query: 'reason for delay explanation promptness permission extension of time',
      answerRoles: ['Court', 'Our side'],
      blocked_by: '',
    });
  }

  (proposals || []).forEach((proposal) => {
    add({
      id: `proposal-${proposal.field}`,
      type: 'proposal',
      severity: 'Medium',
      title: `${proposal.label} holds placeholder text and has been rebuilt from the record`,
      why: 'A placeholder in the fact pattern or chronology carries into every version of the argument.',
      affects: proposal.label,
      question: `Should I use the ${proposal.label} built from the record?`,
      understanding: {
        text: `The ${proposal.label} currently reads “${clip(proposal.current || '', 80) || 'nothing yet'}”. The proposed version is built only from quoted record material.`,
        source: 'The record',
      },
      query: '',
      answerRoles: null,
      blocked_by: '',
      proposal,
    });
  });

  (citations || []).forEach((issue) => {
    add({
      id: issue.id,
      type: 'attribution',
      severity: 'High',
      title: `A quotation is in ${issue.found_name}, but the draft cites ${issue.cited_name}`,
      why: 'A quotation attributed to the wrong document will be rejected, and it undermines the references around it.',
      affects: 'Document references in the draft',
      question: `Is the quotation at ${issue.cited_name} actually in ${issue.found_name}?`,
      understanding: {
        text: `“${clip(issue.quote, 160)}” appears in ${issue.found_name}, ${issue.found_ref}. The draft attributes it to ${issue.cited_name}.`,
        source: `${issue.found_name}, ${issue.found_ref}`,
      },
      query: '',
      answerRoles: null,
      blocked_by: '',
      marker: issue.marker,
      fix: issue.fix,
    });
  });

  const built = items.map((item) => {
    const answer = answers[item.id] || null;
    const query = answer?.corrected_understanding || item.query;
    const recordSays = query
      ? recordAnswers(record, query, item.answerRoles)
      : { answering: [], searched: (record?.documents || []).map((doc) => doc.name), discarded: 0 };
    const withRecord = { ...item, record: recordSays };
    const result = resolve(withRecord, answer);
    if (withRecord.type === 'law_date' && result.evidence.length === 0) {
      result.evidence = (recordSays.candidates || []).slice(0, 3).map((candidate) => ({
        document_name: candidate.document_name,
        ref: candidate.ref,
        quote: candidate.quote,
        verified: true,
        because: 'refers to this provision in the record - it does not state the law',
      }));
    }
    return {
      ...withRecord,
      answer,
      understanding: {
        ...item.understanding,
        text: answer?.corrected_understanding ? answer.corrected_understanding : item.understanding.text,
        corrected: Boolean(answer?.corrected_understanding),
        confirmed: Boolean(answer?.understanding_ok),
      },
      ...result,
    };
  });

  built.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (TYPE_WEIGHT[a.type] ?? 9) - (TYPE_WEIGHT[b.type] ?? 9) ||
      String(a.title).localeCompare(String(b.title))
  );

  const summary = built.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.by_status[item.status] = (acc.by_status[item.status] || 0) + 1;
      if (item.status !== 'Closed' && item.status !== 'Accepted risk') acc.unresolved += 1;
      return acc;
    },
    { total: 0, unresolved: 0, by_status: {} }
  );

  return {
    items: built,
    summary,
    top: built.filter((item) => item.status !== 'Closed' && item.status !== 'Accepted risk').slice(0, 5),
    allDone: built.every((item) => item.status === 'Closed' || item.status === 'Accepted risk'),
  };
}