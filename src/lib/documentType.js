// What a document is, decided from the document itself. Deterministic, no AI.
// Only judgments, orders and transcripts are the Court. A letter is never "Court"
// and never "the judge says".
export const COURT_CATEGORIES = ['Judgments', 'Orders', 'Transcripts'];

const NEUTRAL_CITATION =
  /\[\d{4}\]\s?(?:UKSC|UKHL|UKPC|EWCA|EWHC|EWFC|EWCOP|EWCR|UKUT|UKFTT|UKAIT|CSOH|CSIH|NICA|NIEHC|NIFAM)\s?\d+/i;

const DATE = /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/;

const SIGNALS = [
  {
    category: 'Judgments',
    weight: [
      { re: /approved judgment|judgment approved|^\s*judgment\b/im, w: 4 },
      { re: /IN THE (HIGH COURT|COURT OF APPEAL|SUPREME COURT|COUNTY COURT|CROWN COURT|UPPER TRIBUNAL)/i, w: 2 },
      { re: /\b(handed down|delivered|approved|reasons for judgment)\b/i, w: 2 },
      { re: /judg(e)?ment/i, w: 1 }
    ]
  },
  {
    category: 'Orders',
    weight: [
      { re: /\bIT IS (HEREBY )?(ORDERED|DIRECTED)\b/i, w: 4 },
      { re: /\bUPON (THE |READING )?(HEARING|APPLICATION)\b/i, w: 3 },
      { re: /\border\b/i, w: 1 }
    ]
  },
  {
    category: 'Transcripts',
    weight: [
      { re: /\btranscript\b/i, w: 4 },
      { re: /(proceedings before|before (MR|MRS|MS|HHJ|HIS HONOUR|HER HONOUR))/i, w: 2 }
    ]
  },
  {
    category: 'Witness statements',
    weight: [
      { re: /\bwitness statement\b/i, w: 4 },
      { re: /facts stated in this (witness )?(statement|statement of truth)/i, w: 3 },
      { re: /\bI,\s?[A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){0,3},?\s+of\b/, w: 2 }
    ]
  },
  {
    category: 'Application notices',
    weight: [
      { re: /\bN244\b/i, w: 4 },
      { re: /\bapplication notice\b/i, w: 4 },
      { re: /\b(I|we) (apply|seek)s?\b|\bapplication (is made|to (vary|revoke|reopen|set aside))\b/i, w: 1 }
    ]
  },
  {
    category: 'Skeleton arguments',
    weight: [
      { re: /\bskeleton argument\b/i, w: 4 },
      { re: /\b(skeleton|submissions on behalf of)\b/i, w: 2 }
    ]
  },
  {
    category: 'Exhibits',
    weight: [
      { re: /this is the exhibit|exhibit marked/i, w: 4 },
      { re: /\bexhibit\b/i, w: 1 }
    ]
  },
  {
    category: 'Contracts',
    weight: [
      { re: /\b(terms and conditions|this agreement|this contract|clause \d)/i, w: 2 }
    ]
  },
  {
    category: 'Correspondence',
    weight: [
      { re: /(dear (sirs?|madam|mr|mrs|ms|miss)\b|dear all|yours (faithfully|sincerely)|kind regards)/i, w: 3 },
      { re: /\b(without prejudice|formal escalation|re:|from:|subject:)\b/i, w: 2 },
      { re: /\b(letter|correspondence|email)\b/i, w: 1 }
    ]
  }
];

const NAME_SIGNALS = [
  { re: /judg(e)?ment|approved judgment/i, category: 'Judgments', w: 3 },
  { re: /order\b/i, category: 'Orders', w: 3 },
  { re: /transcript/i, category: 'Transcripts', w: 3 },
  { re: /witness statement|^ws\b|statement of/i, category: 'Witness statements', w: 3 },
  { re: /n244|application notice/i, category: 'Application notices', w: 3 },
  { re: /skeleton/i, category: 'Skeleton arguments', w: 3 },
  { re: /exhibit|^[a-z]{1,3}\d{1,3}\b/i, category: 'Exhibits', w: 2 },
  { re: /letter|correspondence|email|escalation/i, category: 'Correspondence', w: 3 }
];

const SIDE_PATTERNS = [
  { re: /\b(?:solicitors?|agents?)\s+for\s+the\s+(claimant|defendant|respondent|appellant|petitioner|applicant)s?\b/i, weight: 3 },
  { re: /\b(?:on behalf of|acting for)\s+(?:the\s+)?(claimant|defendant|respondent|appellant|petitioner|applicant)s?\b/i, weight: 3 },
  { re: /\bwitness statement of\b[^\n]{0,120}?\((claimant|defendant|respondent|appellant|petitioner|applicant)\)/i, weight: 3 },
  { re: /\bI am the (claimant|defendant|respondent|appellant)\b/i, weight: 2 },
  { re: /\bI,\s?[^\n]{0,80}?\((claimant|defendant|respondent|appellant|petitioner|applicant)\)/i, weight: 2 },
  { re: /\((claimant|defendant|respondent|appellant|petitioner|applicant)\)/i, weight: 1 }
];

// The side the document names for itself, e.g. "solicitors for the Defendant".
export function sideNamedIn(text = '') {
  let best = '';
  let bestWeight = 0;
  SIDE_PATTERNS.forEach((entry) => {
    const match = String(text || '').match(entry.re);
    if (match && entry.weight > bestWeight) {
      best = match[1];
      bestWeight = entry.weight;
    }
  });
  return best ? best.charAt(0).toUpperCase() + best.slice(1).toLowerCase() : '';
}

// Party is never assumed to be ours: it is read from the document and confirmed by the user.
export function detectParty({ text = '', category = '', our_side = '' } = {}) {
  if (COURT_CATEGORIES.includes(category)) {
    return { party: 'Court', reason: "The court's own document" };
  }
  const side = sideNamedIn(text);
  const ours = String(our_side || '');
  if (side && ours) {
    return side.toLowerCase() === ours.toLowerCase()
      ? { party: 'Ours', reason: `The document names the ${side}, which is our side` }
      : { party: 'Other side', reason: `The document names the ${side}, not our side (${ours})` };
  }
  if (side) {
    return { party: '', reason: `The document names the ${side} - confirm which side that is` };
  }
  return { party: '', reason: 'The document does not say which side it comes from' };
}

function scoreFor(category, name, body) {
  const group = SIGNALS.find((entry) => entry.category === category);
  let total = 0;
  (group?.weight || []).forEach((signal) => {
    if (signal.re.test(signal.re.source.startsWith('^') ? body : `${name}\n${body}`)) total += signal.w;
  });
  NAME_SIGNALS.filter((entry) => entry.category === category).forEach((entry) => {
    if (entry.re.test(name)) total += entry.w;
  });
  return total;
}

export function classifyDocument(document = {}) {
  const name = String(document.file_name || document.name || '');
  const text = String(document.text || '');
  const body = text.slice(0, 4000);

  // A neutral citation only marks a judgment where the page itself reads as one.
  const citationLead = NEUTRAL_CITATION.test(`${name}\n${text.slice(0, 900)}`);
  const scores = SIGNALS.map((group) => ({
    category: group.category,
    score: scoreFor(group.category, name, body) + (group.category === 'Judgments' && citationLead ? 3 : 0)
  })).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const category = top && top.score >= 2 ? top.category : 'Other';

  const courtDocument = COURT_CATEGORIES.includes(category);
  const detected = detectParty({
    text: body,
    category,
    our_side: document.our_side || document.client_side_ours || ''
  });
  const chosen = ['Ours', 'Other side', 'Court'].includes(document.party) ? document.party : '';
  const party = courtDocument ? 'Court' : chosen || detected.party;

  const dated = DATE.test(body);

  return {
    category,
    party,
    party_suggested: detected.party,
    party_reason: chosen ? 'Party set by the user' : detected.reason,
    court_document: courtDocument,
    dated,
  };
}

export function roleForCategory(category, party) {
  if (COURT_CATEGORIES.includes(category)) return 'Court';
  if (party === 'Other side') return 'Other party';
  if (party === 'Ours') return 'Our side';
  return 'Unknown';
}