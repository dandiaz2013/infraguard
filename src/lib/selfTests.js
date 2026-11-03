// The self-test suite. Deterministic module tests run in code; each backend
// function is called once with a bounded payload. Nothing touches a live matter.
import { base44 } from '@/api/base44Client';
import { classifyDocument, detectParty } from '@/lib/documentType';
import { detectDocumentDate, detectedLabel } from '@/lib/documentDate';
import { classifyNote } from '@/lib/noteClassify';
import { resolveLineRef } from '@/lib/transcript';
import { splitParagraphs } from '@/lib/paragraphExtract';
import { computeMerits } from '@/lib/scoring';
import { buildCaseLink } from '@/lib/citationUrl';
import { buildRecord, segmentMode } from '@/lib/recordIndex';
import { verifyDraftCitations, toRecordDoc } from '@/lib/caseFile';
import { promptnessFor } from '@/lib/promptness';
import { rateIssue, APPROACHES, ceilingLine, rankOf } from '@/lib/issueRating';
import { rateApproach } from '@/lib/issueApproach';
import { buildFieldGroups, markUserStatement, userStatementLines, USER_MARKER } from '@/lib/fieldStates';
import { resolveRecordBlock } from '@/lib/draftSections';
import { resolveDocumentRefs } from '@/lib/docReferences';
import { applicationDetails, isVariation } from '@/lib/applicationContext';
import { buildDraftRequest, pickParagraphs, skeletonStructure } from '@/lib/documentPack';
import { reliefConflicts } from '@/lib/draftCheck';
import { buildGateway } from '@/lib/gateway';
import { findTestMatter } from '@/lib/testMatter';
import {
  N244_TEXT,
  CLAIMANT_WS_TEXT,
  DEFENDANT_WS_TEXT,
  TRANSCRIPT_TEXT,
  JUDGMENT_TEXT,
  CASE_LAW_TEXT,
  OUR_SIDE,
  TEST_DOCUMENTS,
  TEST_MARKER
} from '@/lib/testFixtures';

const pass = (reason) => ({ pass: true, reason });
const fail = (reason) => ({ pass: false, reason });

function recordDocs() {
  return TEST_DOCUMENTS.map((doc) =>
    toRecordDoc({
      id: doc.file_name,
      file_name: doc.file_name,
      category: doc.category,
      party: doc.party,
      text: doc.text,
      record_status: 'Filed or served',
      date_confirmed: true,
      confirmed_date: detectDocumentDate(doc.text, doc.category).date
    })
  );
}

export const MODULE_TESTS = [
  {
    id: 'date-issue-stamp',
    module: 'documentDate',
    label: 'N244 is dated from the issue stamp, not the date in its body',
    run: () => {
      const found = detectDocumentDate(N244_TEXT, 'Application notices');
      return found.date === '2026-08-19'
        ? pass(`Read 19 August 2026 from the ${found.source}, ignoring 25 March 2025 in the body.`)
        : fail(`Read ${found.date || 'nothing'} from the ${found.source} instead of 2026-08-19.`);
    }
  },
  {
    id: 'date-statement-of-truth',
    module: 'documentDate',
    label: 'Witness statement is dated from its statement of truth',
    run: () => {
      const found = detectDocumentDate(CLAIMANT_WS_TEXT, 'Witness statements');
      return found.date === '2026-06-02'
        ? pass(`Read 2 June 2026 from the ${found.source}, not 25 March 2025 in the evidence.`)
        : fail(`Read ${found.date || 'nothing'} from the ${found.source} instead of 2026-06-02.`);
    }
  },
  {
    id: 'party-defendant',
    module: 'documentType',
    label: 'Defendant witness statement is detected as Other side',
    run: () => {
      const detected = detectParty({ text: DEFENDANT_WS_TEXT, category: 'Witness statements', our_side: OUR_SIDE });
      return detected.party === 'Other side'
        ? pass(detected.reason)
        : fail(`Detected "${detected.party || 'nothing'}" - ${detected.reason}`);
    }
  },
  {
    id: 'party-no-default',
    module: 'documentType',
    label: 'Party is never assumed to be ours',
    run: () => {
      const verdict = classifyDocument({
        file_name: 'Undated note.txt',
        text: 'A note that says nothing about who wrote it or which party it comes from.'
      });
      return verdict.party === ''
        ? pass(`Left blank for confirmation: ${verdict.party_reason}`)
        : fail(`Returned "${verdict.party}" without evidence in the text.`);
    }
  },
  {
    id: 'note-position',
    module: 'noteClassify',
    label: 'An objection is classified as our position',
    run: () => {
      const note = classifyNote('this is not an appeal so 4th WS is not valid');
      return note.kind === 'position' ? pass('Classified as our position.') : fail(`Classified as "${note.kind}".`);
    }
  },
  {
    id: 'transcript-lines',
    module: 'transcript',
    label: 'p.16, ll.9-12 resolves by printed line numbers',
    run: () => {
      const resolved = resolveLineRef(TRANSCRIPT_TEXT, 'p.16, ll.9-12');
      const wanted =
        resolved.text.includes('I first saw the transcript on 3 August 2026') &&
        resolved.text.includes('Did anyone tell you about the order');
      return resolved.found && wanted
        ? pass(`“${resolved.text.slice(0, 100)}...”`)
        : fail(resolved.reason || 'The printed lines were not returned.');
    }
  },
  {
    id: 'paragraph-sub',
    module: 'paragraphExtract',
    label: 'Sub-paragraphs are stored against their paragraph',
    run: () => {
      const blocks = splitParagraphs(
        [
          '39. The claimant says that the order was wrongly made.',
          '(i) The order was made without notice.',
          '(ii) The delay was explained.',
          '(a) A letter was sent.'
        ].join('\n')
      );
      const refs = blocks.map((block) => block.paragraph_ref);
      const wanted = refs.includes('para 39(i)') && refs.includes('para 39(ii)') && refs.includes('para 39(a)');
      return wanted ? pass(refs.join(', ')) : fail(`Refs returned: ${refs.join(', ') || 'none'}`);
    }
  },
  {
    id: 'triage-empty',
    module: 'scoring',
    label: 'An empty triage scores 0 and shows Not answered',
    run: () => {
      const score = computeMerits({ answers: {} });
      const labelled = score.questions.every((question) => question.answer === 'Not answered');
      return score.total === 0 && labelled
        ? pass(`Total 0, ${score.unanswered_count} questions show Not answered.`)
        : fail(`Total ${score.total}; first question labelled ${score.questions[0]?.answer}.`);
    }
  },
  {
    id: 'citation-url',
    module: 'citationUrl',
    label: 'UKHL links, and a trailing full stop is ignored',
    run: () => {
      const ukhl = buildCaseLink('[2001] UKHL 12.');
      const ewhc = buildCaseLink('[2009] EWHC 339 (Ch)');
      return ukhl === 'https://caselaw.nationalarchives.gov.uk/ukhl/2001/12' && Boolean(ewhc)
        ? pass(`${ukhl} and ${ewhc}`)
        : fail(`UKHL returned "${ukhl || 'nothing'}", EWHC returned "${ewhc || 'nothing'}".`);
    }
  },
  {
    id: 'record-para-46',
    module: 'recordIndex',
    label: 'Paragraph 46 resolves with its own text',
    run: () => {
      const record = buildRecord(recordDocs());
      const judgment = record.documents.find((doc) => doc.name.startsWith('Judgment'));
      const segment = judgment?.segments?.find((entry) => entry.ref === 'para 46');
      return segment?.text.includes('voluntary scheme of indemnities')
        ? pass(`${judgment.name} para 46: “${segment.text.slice(0, 90)}...”`)
        : fail(`No text found for para 46 in ${judgment?.name || 'the judgment'}.`);
    }
  },
  {
    id: 'record-beyond-5000',
    module: 'recordIndex',
    label: 'A paragraph beyond character 5,000 of a document resolves',
    run: () => {
      const at = JUDGMENT_TEXT.indexOf('voluntary scheme of indemnities');
      const record = buildRecord(recordDocs());
      const judgment = record.documents.find((doc) => doc.name.startsWith('Judgment'));
      const segment = judgment?.segments?.find((entry) => entry.ref === 'para 46');
      return at > 5000 && Boolean(segment)
        ? pass(`Character ${at} of the judgment, returned in full as para 46 (${segmentMode(JUDGMENT_TEXT)} mode).`)
        : fail(`The passage sits at character ${at} and ${segment ? 'was' : 'was not'} returned.`);
    }
  },
  {
    id: 'quote-not-in-record',
    module: 'caseFile',
    label: 'A quotation that is not in the record is flagged',
    run: () => {
      const record = buildRecord(recordDocs());
      const draft = [
        'The Master said "the claimant was never served with the order at any time".',
        'The order records that "The application is refused."'
      ].join('\n\n');
      const rows = verifyDraftCitations(draft, record);
      const bad = rows.find((row) => row.cited.includes('never served'));
      const good = rows.find((row) => row.cited.includes('The application is refused'));
      return bad && !bad.verified && good?.verified
        ? pass('The invented quotation is flagged; the real one is found in the order.')
        : fail(`Invented quotation verified: ${bad?.verified}; real quotation verified: ${good?.verified}.`);
    }
  },
  {
    id: 'promptness-512',
    module: 'promptness',
    label: 'Promptness is 512 days from the confirmed dates',
    run: () => {
      const result = promptnessFor({ record: buildRecord(recordDocs()) });
      return result.days === 512
        ? pass(`${result.order?.date} to ${result.application?.date} = ${result.interval}`)
        : fail(
            `Measured ${result.days === null ? 'no interval' : `${result.days} days`} (${result.order?.date_text} to ${result.application?.date_text}).`
          );
    }
  },
  {
    id: 'promptness-unconfirmed',
    module: 'promptness',
    label: 'An unconfirmed date is not used for promptness',
    run: () => {
      const docs = recordDocs().map((doc) =>
        doc.category === 'Application notices'
          ? { ...doc, date_confirmed: false, confirmed_date: '2026-08-19' }
          : doc
      );
      const result = promptnessFor({ record: buildRecord(docs) });
      return result.days === null && /Confirm/.test(result.application?.date_text || '')
        ? pass(`No interval used: ${result.application.date_text}`)
        : fail(`Used ${result.days} days from an unconfirmed date.`);
    }
  },
  {
    id: 'rating-explanation',
    module: 'issueRating',
    label: 'An explanation moves Argument, not Evidence',
    run: () => {
      const record = buildRecord(recordDocs());
      const issue = { id: 'delay', label: 'Delay in applying to set aside' };
      const before = rateIssue({ issue, record });
      const after = rateIssue({
        issue,
        record,
        approach: APPROACHES[1],
        explanation:
          'I first saw the transcript on 3 August 2026, when my solicitor sent it, and I applied on 19 August 2026.',
        explanationRef: { document_name: 'Transcript of hearing.txt', ref: 'p.16 lines 9-12' },
        previous: { evidence: before.evidence.rating, argument: before.argument.rating }
      });
      const moved =
        after.argument.rating !== before.argument.rating && after.evidence.rating === before.evidence.rating;
      return moved
        ? pass(
            `Argument ${before.argument.rating} -> ${after.argument.rating}; Evidence stayed ${after.evidence.rating}. ${after.status}.`
          )
        : fail(
            `Argument ${before.argument.rating} -> ${after.argument.rating}; Evidence ${before.evidence.rating} -> ${after.evidence.rating}.`
          );
    }
  },
  {
    id: 'rating-own-statement',
    module: 'issueRating',
    label: 'Our own witness statement is our position, not evidence',
    run: () => {
      const record = buildRecord(recordDocs().filter((doc) => doc.name.startsWith('Witness statement - Jane')));
      const rated = rateIssue({ issue: { id: 'delay', label: 'Delay in applying to set aside' }, record });
      return rated.evidence.rating === 'Weak'
        ? pass(`Evidence stays Weak: ${rated.evidence.reasons[0]}`)
        : fail(`Our own statement raised Evidence to ${rated.evidence.rating}.`);
    }
  },
  {
    id: 'rating-ceiling',
    module: 'issueRating',
    label: 'The weakest issue sets the ceiling',
    run: () => {
      const line = ceilingLine([
        { label: 'Delay', evidence: { rating: 'Reasonable', reasons: ['x'] } },
        { label: 'Change of circumstances', evidence: { rating: 'Weak', reasons: ['No document shows it.'] } }
      ]);
      return line.startsWith('Weakest issue sets the ceiling: Change of circumstances')
        ? pass(line)
        : fail(line || 'No ceiling line returned.');
    }
  },
  {
    id: 'date-n244-no-stamp',
    module: 'documentDate',
    label: 'An N244 with no issue stamp takes no date from its body',
    run: () => {
      const text = [
        'N244 Application notice',
        'Claim No. CH-2024-000123',
        'The defendant asks the court to set aside the order dated 25 March 2025.',
        'Signed: A. Solicitor'
      ].join('\n');
      const found = detectDocumentDate(text, 'Application notices');
      const label = detectedLabel(found);
      return !found.date && label === 'Date not found - enter it'
        ? pass('No date taken from the body; the user is asked to enter it.')
        : fail(`Read "${found.date || label}" instead of asking for the date.`);
    }
  },
  {
    id: 'transcript-lines-in-pack',
    module: 'docReferences',
    label: 'A transcript citation resolves to the printed page and lines in the source pack',
    run: () => {
      const docs = [{ id: 'transcript', name: 'Transcript of hearing.txt', text: TRANSCRIPT_TEXT }];
      const rows = resolveDocumentRefs('See {{DOC:transcript|p.16 lines 9-12}}.', docs);
      const row = rows[0];
      if (!row) return fail('The reference was not read at all.');
      const ok =
        row.status === 'found' &&
        /p\.\s?16/i.test(row.label) &&
        /first saw the transcript on 3 August 2026/i.test(row.text || '');
      return ok
        ? pass(`${row.label}: “${String(row.text).slice(0, 70)}…”`)
        : fail(`${row.statusLabel}: ${row.detail || row.text || 'no text'}`);
    }
  },
  {
    id: 'field-states',
    module: 'fieldStates',
    label: 'Each field is from the documents, written by you, or not yet provided',
    run: () => {
      const record = buildRecord(recordDocs());
      const expansions = [
        'The defendant operated a voluntary scheme of indemnities.',
        'No one explained the indemnity to the claimant before the order was made.',
        'The claimant wrote twice before the hearing.'
      ].join('\n');
      const groups = buildFieldGroups({
        record,
        gateway: [],
        ourPoints: [],
        clauses: [],
        misstatements: [],
        chronology: null,
        expansions: { undisputed_facts: expansions },
        userFields: { 'fact:1': { text: 'No one explained the indemnity to the claimant before the order was made.', group: 'facts' } }
      });
      const facts = groups.find((group) => group.id === 'facts').fields.slice(0, 3);
      const states = facts.map((field) => field.state).join(',');
      const marked = userStatementLines(groups)[0] || {};
      const ok =
        states === 'documents,yours,missing' &&
        Boolean(facts[0].document_name) &&
        String(marked.text || '').includes(USER_MARKER);
      return ok
        ? pass('From the documents, written by you, not yet provided — the written one carries the marker.')
        : fail(`States read ${states}; marker ${String(marked.text || '').includes(USER_MARKER) ? 'present' : 'missing'}.`);
    }
  },
  {
    id: 'draft-beyond-5000',
    module: 'draftSections',
    label: 'A paragraph beyond character 5,000 is sent to the draft in full',
    run: () => {
      const padding = new Array(90)
        .fill('This paragraph is background and carries nothing the draft relies on.')
        .join('\n\n');
      const text = `${padding}\n\n46. The judge said the scheme was voluntary.\n`;
      const block = resolveRecordBlock({ document_name: 'Long judgment.txt', ref: 'para 46' }, [
        { id: 'long', name: 'Long judgment.txt', text }
      ]);
      if (!block) return fail('Paragraph 46 was not found in the long document.');
      const beyond = text.indexOf('46. The judge') > 5000;
      return beyond && /voluntary/i.test(block.text)
        ? pass(`Paragraph 46 sits at character ${text.indexOf('46. The judge')} and is returned in full.`)
        : fail(`Paragraph 46 returned "${block.text.slice(0, 60)}" (beyond 5,000: ${beyond}).`);
    }
  },
  {
    id: 'rating-explanation-argument-only',
    module: 'issueApproach',
    label: 'A user explanation changes ARGUMENT but never EVIDENCE',
    run: () => {
      const record = buildRecord(recordDocs());
      const issue = { id: 'promptness', label: 'Delay in applying to set aside', ask: 'What explains the interval?' };
      const before = rateApproach({ issue, record, extracts: [] });
      const after = rateApproach({
        issue,
        approachIds: ['interval-explained'],
        explanation: 'The interval is explained by the illness set out in the witness statement, so the delay is accounted for.',
        source: { document_name: 'Witness statement - Jane Brown (Claimant).txt', ref: 'para 4' },
        record,
        extracts: [],
        previous: { evidence: before.evidence.rating, argument: before.argument.rating }
      });
      const dimensions = (after.changes || []).map((change) => change.dimension).join(',');
      const ok =
        after.evidence.rating === before.evidence.rating &&
        rankOf(after.argument.rating) > rankOf(before.argument.rating) &&
        dimensions === 'Argument';
      return ok
        ? pass(`Evidence stayed ${after.evidence.rating}; Argument ${before.argument.rating} → ${after.argument.rating}.`)
        : fail(`Evidence ${before.evidence.rating} → ${after.evidence.rating}; Argument ${before.argument.rating} → ${after.argument.rating}; changes: ${dimensions || 'none'}.`);
    }
  },
  {
    id: 'user-answer-marker',
    module: 'fieldStates',
    label: 'A user-written answer carries the marker into the draft',
    run: () => {
      const marked = markUserStatement('The order was never served on the claimant.');
      const ok = marked.endsWith(USER_MARKER) && marked.startsWith('The order was never served');
      return ok ? pass(marked) : fail(marked || 'No marked text.');
    }
  },
  {
    id: 'merge-duplicate-case',
    module: 'parseJudgment',
    label: 'A case extracted twice becomes one record with both citations',
    run: async () => {
      const found = await base44.entities.Judgment.filter({ title: `${TEST_MARKER} - citations` });
      const judgment = (Array.isArray(found) ? found : found?.items || [])[0];
      if (!judgment) return fail('The self-test citation judgment is missing. Create the test data first.');

      const name = 'Merge Test Ltd v Ashfield Holdings Ltd';
      const response = await base44.functions.invoke('parseJudgment', {
        judgment_id: judgment.id,
        candidates: [
          { name, neutral_citation: '[2021] UKSC 99', paragraph_ref: '[4]' },
          { name, neutral_citation: '[2021] 2 WLR 55', paragraph_ref: '[4]', link_status: 'Law report citation, no automatic link' }
        ]
      });
      if (response.data?.error) return fail(`Returned an error: ${response.data.error}`);

      const rows = await base44.entities.CaseLaw.filter({ name });
      const list = Array.isArray(rows) ? rows : rows?.items || [];
      const merged =
        list.length === 1 &&
        list[0].neutral_citation === '[2021] UKSC 99' &&
        list[0].report_reference === '[2021] 2 WLR 55';

      await Promise.all(
        list.filter((record) => /Parsed from judgment/.test(record.source_note || '')).map((record) => base44.entities.CaseLaw.delete(record.id))
      );

      return merged
        ? pass('One record carrying [2021] UKSC 99 and [2021] 2 WLR 55.')
        : fail(
            `${list.length} record(s): neutral "${list[0]?.neutral_citation || 'none'}", report "${list[0]?.report_reference || 'none'}".`
          );
    }
  },
  {
    id: 'skeleton-from-argument',
    module: 'legalDocumentDraft',
    label: 'The skeleton names the order challenged, every gateway issue, and cites the N244 and witness statement',
    run: async () => {
      const documents = TEST_DOCUMENTS.map((doc) => ({
        id: doc.file_name,
        file_name: doc.file_name,
        category: doc.category,
        party: doc.party,
        text: doc.text,
        record_status: 'Filed or served',
        confirmed_date: detectDocumentDate(doc.text, doc.category).date,
        date_confirmed: true
      }));
      const orderDoc = documents.find((doc) => doc.category === 'Orders');
      const notice = documents.find((doc) => doc.category === 'Application notices');
      const statement = documents.find(
        (doc) => doc.category === 'Witness statements' && /Jane/.test(doc.file_name)
      );
      if (!orderDoc || !notice || !statement) return fail('The self-test documents are incomplete.');

      const record = buildRecord(documents.map(toRecordDoc));
      const details = applicationDetails({ documents, orderId: orderDoc.id });
      const variation = isVariation(details);
      const extracts = [
        {
          case_law_id: 'self-test-authority',
          case_name: 'Philipp v Barclays Bank UK plc',
          citation: '[2023] UKSC 25',
          paragraph_ref: '115',
          extract_text:
            'The bank owed no general duty to protect the customer from the fraud of a third party, because the customer authorised the payments.',
          proposition: 'No general duty to protect a customer from authorised payment fraud.',
          checked: true
        }
      ];
      const promptness = promptnessFor({ record, orderId: orderDoc.id, extracts });
      const gateway = buildGateway({ record, extracts, promptness });
      const pack = pickParagraphs({ record, gateway, ourPoints: [] });

      const request = buildDraftRequest({
        documentType: 'Skeleton Argument',
        briefingNotes:
          'Self-test skeleton: the application is to set aside the order of Master Brown dated 25 March 2025.',
        ourSide: OUR_SIDE,
        court: 'High Court',
        application: details,
        order: details.order,
        orderFound: true,
        variation,
        structure: skeletonStructure({ documentType: 'Skeleton Argument', variation }),
        paragraphs: pack.paragraphs,
        gateway,
        savedByIssue: {},
        promptness,
        tests: [],
        extracts,
        registerItems: [],
        userStatements: [],
        supplementary: '',
        pinned: []
      });

      const response = await base44.functions.invoke('legalDocumentDraft', request);
      if (response.data?.error) return fail(`Returned an error: ${response.data.error}`);
      const content = String(response.data?.content || '');
      if (!content.trim()) return fail('Returned nothing.');

      const problems = [];
      if (!/25 March 2025/.test(content) || !/master brown/i.test(content)) {
        problems.push('the order challenged is not named with its date');
      }
      [
        ['route', /jurisdiction|route|which rule/i],
        ['gateway', /misstatement|misstated|change of circumstances/i],
        ['materiality', /materiality|turned on|made a difference|made no difference/i],
        ['knowable', /knowable|when .{0,30}knew|known/i],
        ['promptness', /delay|prompt|interval/i],
        ['finality', /finality|final|appeal/i],
        ['relief', /relief|set aside|vary/i]
      ].forEach(([id, pattern]) => {
        if (!pattern.test(content)) problems.push(`gateway issue ${id} is missing`);
      });
      if (!content.includes(`{{DOC:${notice.id}|`)) problems.push('no {{DOC}} reference to the N244');
      if (!content.includes(`{{DOC:${statement.id}|`)) {
        problems.push('no {{DOC}} reference to the witness statement');
      }

      const conflicts = reliefConflicts(content, { variation, order: details.order });
      if (conflicts.length) {
        problems.push(`the relief asks to maintain a decision: ${conflicts[0].passage.slice(0, 80)}`);
      }

      // An authority may only be described from a stored extract, or be left in a marker.
      const markers = [...content.matchAll(/\[NO EXTRACT:([^\]]*)\]/g)].map((match) => match[1].toLowerCase());
      const CASE =
        /\b([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){0,4})\s+v\.?\s+([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){0,4})/g;
      let hit;
      while ((hit = CASE.exec(content)) !== null) {
        const name = `${hit[1]} v ${hit[2]}`.replace(/\s+/g, ' ').trim();
        if (/Ashfield/i.test(name) || /philipp/i.test(name)) continue;
        if (markers.some((marker) => marker.includes(hit[1].toLowerCase()))) continue;
        problems.push(`"${name}" is described without a stored extract`);
      }

      return problems.length === 0
        ? pass(
            `Named ${details.order?.name || 'the order'} (${details.order?.date_text || 'date'}), all seven gateway issues, {{DOC}} references to the N244 and the witness statement, and no request to maintain the decision.`
          )
        : fail(problems.join('; '));
    }
  }
];

const FUNCTION_NAMES = [
  'argumentCoach',
  'argumentSections',
  'argumentProspects',
  'argumentQuestions',
  'caseWorkflowArguments',
  'documentTextExtract',
  'extractMatterAuthorities',
  'findAuthorityTest',
  'judgmentAnalysis',
  'legalArgumentDraft',
  'legalArgumentFactCheck',
  'legalDocumentDraft',
  'legalResearch',
  'legalTests',
  'parseJudgment',
  'recordAuthorityPrinciples',
  'witnessGapAnalysis',
  'workflowArgumentDraft'
];

export const FUNCTION_COUNT = FUNCTION_NAMES.length;

async function functionPayload() {
  const matter = await findTestMatter();
  const laws = await base44.entities.CaseLaw.filter({ source_note: TEST_MARKER });
  const authority = (Array.isArray(laws) ? laws : [])[0];
  const judgments = await base44.entities.Judgment.filter({ title: `${TEST_MARKER} - Brown v Ashfield` });
  const judgment = (Array.isArray(judgments) ? judgments : [])[0];

  return {
    matter_id: matter?.id || '',
    matterName: 'Self-test matter',
    matterType: 'Civil Litigation',
    court: 'High Court',
    position: 'Appellant',
    factPattern: 'The order of 25 March 2025 was made without notice. The application was issued on 19 August 2026.',
    fact_pattern: 'The order of 25 March 2025 was made without notice. The application was issued on 19 August 2026.',
    generatedArgument: 'The order should be set aside because it was made without notice to the claimant.',
    argument: 'The order should be set aside because it was made without notice to the claimant.',
    argument_text: 'The order should be set aside because it was made without notice to the claimant.',
    issueTitle: 'Whether the order should be set aside',
    briefingNotes: 'Self-test note: the order was made without notice.',
    documentType: 'Skeleton Argument',
    our_points: [],
    misstatements: [],
    contract_clauses: [],
    authorities: [],
    extracts: [],
    main_authorities: [],
    documents: [],
    record_documents: [],
    record_findings: [],
    source_material: [],
    legal_tests: [],
    register_items: [],
    expansions: {},
    promptness_note: 'The order is dated 25 March 2025 and the application 19 August 2026.',
    question_answers: [],
    checklist: [],
    questions: [],
    answers: {},
    round: 1,
    mode: 'initial',
    points: [],
    text: CASE_LAW_TEXT,
    case_law_id: authority?.id || '',
    judgment_id: judgment?.id || '',
    judgmentText: JUDGMENT_TEXT,
    researchQuery: 'promptness of an application to set aside an order made without notice',
    candidates: [],
    include_unverified: false,
    fileName: 'self-test.txt',
    fileBase64: 'U2VsZi10ZXN0IGRvY3VtZW50Lg=='
  };
}

async function genericFunctionRun(name) {
  const response = await base44.functions.invoke(name, await functionPayload());
  const data = response?.data;
  if (data === undefined || data === null) return fail('Returned nothing.');
  if (typeof data === 'object' && data.error) return fail(`Returned an error: ${data.error}`);
  if (typeof data === 'string' && data.trim().length === 0) return fail('Returned an empty response.');
  const keys = typeof data === 'object' ? Object.keys(data).slice(0, 4).join(', ') : 'an answer';
  return pass(`Returned ${keys || 'a response'}.`);
}

// parseJudgment is deterministic without a candidates array: it returns what the
// citation parser reads from the stored text, so the extraction is tested in code.
async function parseJudgmentRun() {
  const found = await base44.entities.Judgment.filter({ title: `${TEST_MARKER} - citations` });
  const judgment = (Array.isArray(found) ? found : found?.items || [])[0];
  if (!judgment) return fail('The self-test citation judgment is missing. Create the test data first.');

  const response = await base44.functions.invoke('parseJudgment', { judgment_id: judgment.id });
  const data = response?.data;
  if (data?.error) return fail(`Returned an error: ${data.error}`);

  const candidates = data?.candidates || [];
  const philipp = candidates.find((entry) => entry.neutral_citation === '[2023] UKSC 25');
  const tibbles = candidates.find((entry) => entry.neutral_citation === '[2012] EWCA Civ 518');
  const bracketed = candidates.some((entry) => entry.neutral_citation === '[2009] EWHC 339 (Ch)');
  const bare = candidates.some((entry) => entry.neutral_citation === '[2009] EWHC 339 Ch');
  const lawReport = candidates.find((entry) => entry.neutral_citation === '[1992] 4 All ER 363');

  const problems = [];
  const rbs = candidates.find((entry) => entry.neutral_citation === '[2022] UKSC 50');
  const miller = candidates.find((entry) => entry.neutral_citation === '[2017] UKSC 5');
  const reportDuplicate = candidates.find((entry) => entry.neutral_citation === '[2023] 3 WLR 456');
  if (rbs?.name !== 'Royal Bank of Scotland International Ltd v JP SPC 4') {
    problems.push(`lowercase "of" lost: "${rbs?.name}"`);
  }
  if (miller?.name !== 'R (Miller) v Secretary of State for Exiting the European Union') {
    problems.push(`"Secretary of State" read as "${miller?.name}"`);
  }
  if (reportDuplicate?.name !== 'Philipp v Barclays Bank UK plc') {
    problems.push(`law report citation named "${reportDuplicate?.name}" instead of the case`);
  }
  if (philipp?.name !== 'Philipp v Barclays Bank UK plc') problems.push(`name read as "${philipp?.name}"`);
  if (philipp?.paragraph_ref !== '[115]') problems.push(`Philipp pinpoint read as "${philipp?.paragraph_ref || 'none'}"`);
  if (tibbles?.paragraph_ref !== '[39]') problems.push(`Tibbles pinpoint read as "${tibbles?.paragraph_ref || 'none'}"`);
  if (tibbles?.name !== 'Tibbles v SIG plc') problems.push(`"See also" left in the name: "${tibbles?.name}"`);
  if (!bracketed) problems.push('EWHC with brackets not found');
  if (!bare) problems.push('EWHC without brackets not found');
  if (lawReport?.link_status !== 'Law report citation, no automatic link') {
    problems.push(`law report status "${lawReport?.link_status || 'not recorded'}"`);
  }
  return problems.length === 0
    ? pass(`${candidates.length} candidates: Philipp [115], Tibbles [39], both EWHC forms, law report flagged.`)
    : fail(problems.join('; '));
}

export const FUNCTION_TESTS = FUNCTION_NAMES.map((name) => ({
  id: `fn-${name}`,
  module: 'function',
  label: name,
  run: name === 'parseJudgment' ? parseJudgmentRun : () => genericFunctionRun(name)
}));

export const ALL_TESTS = [...MODULE_TESTS, ...FUNCTION_TESTS];