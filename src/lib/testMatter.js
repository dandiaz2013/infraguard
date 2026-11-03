// The self-test matter: synthetic documents, kept separate from live matters.
// Every document is labelled, and "Delete test data" removes all of it.
import { base44 } from '@/api/base44Client';
import { classifyDocument, detectParty } from '@/lib/documentType';
import { detectDocumentDate } from '@/lib/documentDate';
import {
  TEST_REFERENCE,
  TEST_MATTER_NAME,
  TEST_MARKER,
  OUR_SIDE,
  TEST_DOCUMENTS,
  JUDGMENT_TEXT,
  CASE_LAW_TEXT
} from '@/lib/testFixtures';

export { TEST_REFERENCE, TEST_MATTER_NAME, TEST_MARKER, OUR_SIDE };

function buildDocuments(matterId) {
  return TEST_DOCUMENTS.map((doc) => {
    const verdict = classifyDocument({ file_name: doc.file_name, text: doc.text, party: doc.party });
    const category = doc.category || verdict.category;
    const party = doc.party || detectParty({ text: doc.text, category, our_side: OUR_SIDE }).party;
    const detection = detectDocumentDate(doc.text, category);
    return {
      matter_id: matterId,
      file_name: doc.file_name,
      category,
      party: party || undefined,
      party_confirmed: Boolean(party),
      party_reason: TEST_MARKER,
      document_date: detection.date || undefined,
      detected_date: detection.date,
      confirmed_date: detection.date,
      date_confirmed: Boolean(detection.date),
      case_number: 'CH-2024-000123',
      record_status: 'Filed or served',
      text: doc.text,
      char_count: doc.text.length,
      truncated: false,
      source: TEST_MARKER
    };
  });
}

export async function findTestMatter() {
  const found = await base44.entities.Matter.filter({ matter_reference: TEST_REFERENCE });
  const list = Array.isArray(found) ? found : found?.items || [];
  return list[0] || null;
}

export async function createTestData() {
  let matter = await findTestMatter();
  if (!matter) {
    matter = await base44.entities.Matter.create({
      matter_reference: TEST_REFERENCE,
      matter_name: TEST_MATTER_NAME,
      client_name: 'Test Client',
      matter_type: 'Civil Litigation',
      court: 'High Court',
      our_side: OUR_SIDE,
      status: 'On Hold',
      description: `${TEST_MARKER} - synthetic documents used by the self-test page. Deleting this matter does not touch live matters.`
    });
  }

  const existing = await base44.entities.CaseFileDocument.filter({ matter_id: matter.id });
  if (!(Array.isArray(existing) ? existing : existing?.items || []).length) {
    await base44.entities.CaseFileDocument.bulkCreate(buildDocuments(matter.id));
  }

  const lawFound = await base44.entities.CaseLaw.filter({ source_note: TEST_MARKER });
  const laws = Array.isArray(lawFound) ? lawFound : lawFound?.items || [];
  let authority = laws[0];
  if (!authority) {
    authority = await base44.entities.CaseLaw.create({
      name: 'Philipp v Barclays Bank UK plc',
      neutral_citation: '[2023] UKSC 25',
      court: 'Supreme Court',
      year: 2023,
      summary: `${TEST_MARKER} - the duty of a bank in an authorised payment fraud.`,
      verified: true,
      check_status: 'Extract checked against official text',
      source_note: TEST_MARKER
    });
    await base44.entities.AuthorityExtract.create({
      case_law_id: authority.id,
      paragraph_ref: '115',
      extract_text:
        'The bank owed no general duty to protect the customer from the fraud of a third party, because the customer authorised the payments.',
      proposition: `${TEST_MARKER} - duty`,
      status: 'Extract checked against official text',
      helps_hurts: 'Not classified'
    });
  }

  const judgmentFound = await base44.entities.Judgment.filter({ title: `${TEST_MARKER} - Brown v Ashfield` });
  const judgments = Array.isArray(judgmentFound) ? judgmentFound : judgmentFound?.items || [];
  if (!judgments.length) {
    await base44.entities.Judgment.create({
      title: `${TEST_MARKER} - Brown v Ashfield`,
      court: 'High Court',
      raw_text: JUDGMENT_TEXT,
      parse_status: 'unparsed'
    });
  }

  const citationFound = await base44.entities.Judgment.filter({ title: `${TEST_MARKER} - citations` });
  const citationJudgments = Array.isArray(citationFound) ? citationFound : citationFound?.items || [];
  if (!citationJudgments.length) {
    await base44.entities.Judgment.create({
      title: `${TEST_MARKER} - citations`,
      court: 'High Court',
      raw_text: `A judgment referring to the following authorities.\n\n${CASE_LAW_TEXT}`,
      parse_status: 'unparsed'
    });
  }

  return matter;
}

export async function deleteTestData() {
  const matter = await findTestMatter();
  if (matter) {
    await base44.entities.CaseFileDocument.deleteMany({ matter_id: matter.id });
    await base44.entities.Matter.delete(matter.id);
  }

  const laws = await base44.entities.CaseLaw.filter({ source_note: TEST_MARKER });
  for (const law of Array.isArray(laws) ? laws : []) {
    await base44.entities.AuthorityExtract.deleteMany({ case_law_id: law.id });
    await base44.entities.CaseLaw.delete(law.id);
  }

  const judgments = await base44.entities.Judgment.list();
  const mine = (Array.isArray(judgments) ? judgments : judgments?.items || []).filter((judgment) =>
    String(judgment.title || '').startsWith(TEST_MARKER)
  );
  for (const judgment of mine) {
    await base44.entities.Judgment.delete(judgment.id);
  }

  return true;
}