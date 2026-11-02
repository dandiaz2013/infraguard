// Builds a supplementary witness statement from the fact list answers only.
// No AI: anything the user has not answered stays as [FACT NEEDED].

export const FACT_NEEDED = '[FACT NEEDED]';

export const SAFETY_FOOTER =
  'Draft for review. Check every authority and document reference against the originals before filing. Not legal advice.';

export function buildSupplementaryStatement({
  factList = [],
  witnessName = '',
  matterName = '',
  court = '',
  date = new Date(),
}) {
  const items = (factList || []).filter((item) => item && (item.prompt || item.answer));
  const paragraphs = items.map((item, index) => {
    const answer = String(item.answer || '').trim();
    const body = answer || `${FACT_NEEDED} ${item.prompt || 'State the fact needed here.'}`;
    return `${index + 1}. ${body}`;
  });

  const dated = (date instanceof Date ? date : new Date()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const name = witnessName.trim() || '[WITNESS NAME]';

  const lines = [
    `# SUPPLEMENTARY WITNESS STATEMENT OF ${name}`,
    '',
    `Matter: ${matterName || '[MATTER]'}${court ? ` | Court: ${court}` : ''}`,
    `Date: ${dated}`,
    '',
    `I, ${name}, of [ADDRESS], will say as follows:`,
    '',
    ...(paragraphs.length > 0 ? paragraphs : ['1. [FACT NEEDED] No facts have been supplied yet.']),
    '',
    '## STATEMENT OF TRUTH',
    'I believe that the facts stated in this witness statement are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a witness statement without an honest belief in its truth.',
    '',
    'Signed: ______________________',
    `Name: ${name}`,
    'Dated: ______________________',
    '',
    SAFETY_FOOTER,
  ];

  const openCount = items.filter((item) => !String(item.answer || '').trim()).length;

  return { text: lines.join('\n'), openCount, total: items.length };
}