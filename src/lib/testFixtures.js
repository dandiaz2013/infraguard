// Synthetic documents for the self-test. Text only: no SDK, no entity writes,
// so the same fixtures can be used by the tests and by the data builder.
export const TEST_REFERENCE = 'TEST-0001';
export const TEST_MATTER_NAME = 'SELF-TEST (synthetic) - not a live matter';
export const TEST_MARKER = 'SELF-TEST (synthetic)';
export const OUR_SIDE = 'Claimant';

function buildJudgment() {
  const lines = [
    'IN THE HIGH COURT OF JUSTICE',
    'BUSINESS AND PROPERTY COURTS OF ENGLAND AND WALES',
    'CHANCERY DIVISION',
    '[2024] EWHC 2100 (Ch)',
    'BROWN v ASHFIELD HOLDINGS LIMITED',
    'Approved Judgment',
    'Handed down on 12 December 2024',
    ''
  ];
  for (let n = 1; n <= 60; n += 1) {
    if (n === 46) {
      lines.push(
        '46. The defendant operated a voluntary scheme of indemnities under which suppliers were reimbursed for the cost of the works.'
      );
    } else if (n === 58) {
      lines.push(
        "58. Nothing in this judgment affects the claimant's right to apply to set aside the order made on 25 March 2025."
      );
    } else {
      lines.push(
        `${n}. The court has considered the evidence and the submissions of the parties on this point and records its conclusion.`
      );
    }
  }
  return lines.join('\n');
}

export const JUDGMENT_TEXT = buildJudgment();

export const ORDER_TEXT = [
  'IN THE HIGH COURT OF JUSTICE',
  'BUSINESS AND PROPERTY COURTS OF ENGLAND AND WALES',
  'CHANCERY DIVISION',
  'Case No. CH-2024-000123',
  'BROWN v ASHFIELD HOLDINGS LIMITED',
  '',
  'ORDER',
  '',
  'UPON the application of the Claimant',
  'IT IS ORDERED that:',
  '1. The application is refused.',
  "2. The Defendant's costs are to be assessed if not agreed.",
  '',
  'DATED 25 March 2025'
].join('\n');

export const N244_TEXT = [
  'N244 Application notice',
  'Continuation sheet',
  'Case No. CH-2024-000123',
  '',
  'The Claimant applies to set aside the order of Master Brown dated 25 March 2025 ("the Order") on the grounds that the Order was made without notice to the Claimant.',
  '',
  '1. The Order was made on 25 March 2025 and was not served on the Claimant.',
  '2. The Claimant first saw the transcript on 3 August 2026.',
  '',
  'Issued on 19 August 2026'
].join('\n');

export const CLAIMANT_WS_TEXT = [
  'WITNESS STATEMENT OF JANE BROWN (Claimant)',
  '',
  'I, Jane Brown, of 14 Ash Lane, Bristol, will say as follows:',
  '',
  '1. I am the Claimant in these proceedings.',
  '2. The order was made on 25 March 2025 and I was not told about it at the time.',
  '3. I first saw the transcript on 3 August 2026, when my solicitor sent it to me.',
  '',
  'STATEMENT OF TRUTH',
  'I believe that the facts stated in this witness statement are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth.',
  '',
  'Signed: J. Brown',
  'Dated: 2 June 2026'
].join('\n');

export const DEFENDANT_WS_TEXT = [
  'WITNESS STATEMENT OF MICHAEL HALL',
  '',
  'I, Michael Hall, of 2 Kingsway, London, will say as follows:',
  '',
  '1. I am the operations manager of the Defendant and I am authorised to give this statement on behalf of the Defendant.',
  '2. The order was served on the Claimant by email on 27 March 2025.',
  '',
  'STATEMENT OF TRUTH',
  'I believe that the facts stated in this witness statement are true.',
  '',
  'Signed: M. Hall',
  'Dated: 20 June 2026'
].join('\n');

export const TRANSCRIPT_TEXT = [
  'IN THE HIGH COURT OF JUSTICE',
  'BROWN v ASHFIELD HOLDINGS LIMITED',
  'Transcript of the hearing before Master Brown',
  '',
  'Page 15',
  ' 5   Q. Was the order sent to you?',
  ' 6   A. No, it was not.',
  ' 7   Q. Did you ask for a copy?',
  '',
  'Page 16',
  ' 8   Q. When did you first see the transcript?',
  ' 9   A. I first saw the transcript on 3 August 2026, when my solicitor sent it to me.',
  '10   Q. Had you seen the order before that?',
  '11   A. No, I had not seen the order at any time before that.',
  '12   Q. Did anyone tell you about the order?',
  '13   A. Nobody told me anything about it.'
].join('\n');

export const LETTER_TEXT = [
  'HALL & CO SOLICITORS',
  '2 Kingsway, London',
  '',
  '3 July 2025',
  '',
  'Dear Sirs,',
  '',
  'We refer to the order dated 25 March 2025. Our client will oppose any application to set it aside.',
  '',
  'Yours faithfully,',
  'Hall & Co'
].join('\n');

export const CASE_LAW_TEXT = [
  'Philipp v Barclays Bank UK plc [2023] UKSC 25 at [115]. The Supreme Court held that a bank owes no general duty to protect a customer from authorised payment fraud.',
  'See also Tibbles v SIG plc [2012] EWCA Civ 518 at [39].',
  'Rolled Steel Products (Holdings) Ltd v British Steel Corporation [1986] Ch 246.',
  'Rex v Smith [2009] EWHC 339 (Ch) at [12].',
  'Brown v Green [2009] EWHC 339 Ch at [7].',
  'Adams v Wall [1992] 4 All ER 363 and Davy v Mott [2006] 1 WLR 1945.',
  'Royal Bank of Scotland International Ltd v JP SPC 4 [2022] UKSC 50.',
  'R (Miller) v Secretary of State for Exiting the European Union [2017] UKSC 5.',
  'Philipp v Barclays Bank UK plc [2023] 3 WLR 456.'
].join('\n');

// Party left blank where the document must be detected rather than assumed.
export const TEST_DOCUMENTS = [
  { file_name: 'Judgment - Brown v Ashfield Holdings Limited.txt', category: 'Judgments', party: 'Court', text: JUDGMENT_TEXT },
  { file_name: 'Order of Master Brown.txt', category: 'Orders', party: 'Court', text: ORDER_TEXT },
  { file_name: 'N244 continuation sheet.txt', category: 'Application notices', party: 'Ours', text: N244_TEXT },
  { file_name: 'Witness statement - Jane Brown (Claimant).txt', category: 'Witness statements', party: '', text: CLAIMANT_WS_TEXT },
  { file_name: 'Witness statement - Michael Hall.txt', category: 'Witness statements', party: '', text: DEFENDANT_WS_TEXT },
  { file_name: 'Transcript of hearing.txt', category: 'Transcripts', party: 'Court', text: TRANSCRIPT_TEXT },
  { file_name: 'Letter from Hall & Co.txt', category: 'Correspondence', party: '', text: LETTER_TEXT },
  { file_name: 'Case law text with citations.txt', category: 'Judgments', party: 'Court', text: CASE_LAW_TEXT }
];