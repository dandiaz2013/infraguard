// The self-test suite. Deterministic module tests run in code; each backend
// function is called once with a bounded payload. Nothing touches a live matter.
import { base44 } from '@/api/base44Client';
import { classifyDocument, detectParty } from '@/lib/documentType';
import { detectDocumentDate } from '@/lib/documentDate';
import { classifyNote } from '@/lib/noteClassify';
import { resolveLineRef } from '@/lib/transcript';
import { splitParagraphs } from '@/lib/paragraphExtract';
import { computeMerits } from '@/lib/scoring';
import { buildCaseLink } from '@/lib/citationUrl';
import { buildRecord, segmentMode } from '@/lib/recordIndex';
import { verifyDraftCitations, toRecordDoc } from '@/lib/caseFile';
import { promptnessFor } from '@/lib/promptness';
import { rateIssue, APPROACHES, ceilingLine } from '@/lib/issueRating';
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
  }
];

const FUNCTION_NAMES = [
  'argumentCoach',
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