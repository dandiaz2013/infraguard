// Shared rules for main authorities, used by every drafting function.
// A quotation may only come from a stored extract.

const MAX_AUTHORITIES = 20;
const MAX_EXTRACTS = 12;
const MAX_EXTRACT_CHARS = 1200;

export const MAIN_AUTHORITY_RULES = `## Main authorities - absolute rules
- Quote ONLY from the EXACT TEXT of a stored extract listed under MAIN AUTHORITIES, and copy the wording character for character.
- Give the case name, the neutral citation and the stored paragraph reference with every quotation.
- Never write a paragraph number or a quotation that is not stored in an extract.
- A main authority with no extract: cite the case name and neutral citation only, then add [NO EXTRACT - PARAGRAPH NEEDED].
- A main authority whose check status is NOT CHECKED: write [NOT CHECKED - VERIFY BEFORE USE] at every place you cite it, including the first citation in the document.
- Cite main authorities first, before any other authority.`;

export function buildMainAuthorityBlock(list: Record<string, unknown>[] | undefined) {
  if (!Array.isArray(list) || list.length === 0) return '';

  const blocks = list.slice(0, MAX_AUTHORITIES).map((record: Record<string, unknown>) => {
    const extracts = Array.isArray(record.extracts) ? (record.extracts as Record<string, string>[]) : [];
    const lines = [
      `- Case name: ${record.name || 'unnamed authority'}`,
      `  Neutral citation: ${record.citation || 'none stored'}`,
      `  Court: ${record.court || 'not stored'}`,
      `  Year: ${record.year || 'not stored'}`,
      `  Official link: ${record.official_url || 'none stored'}`,
      `  Check status: ${record.checked === true ? 'EXTRACTS CHECKED against the official text' : 'NOT CHECKED - VERIFY BEFORE USE'}`,
    ];

    if (extracts.length === 0) {
      lines.push('  Extracts: NONE - cite this case by name and citation only, then add [NO EXTRACT - PARAGRAPH NEEDED]');
    } else {
      lines.push('  Stored extracts - the ONLY wording you may quote:');
      extracts.slice(0, MAX_EXTRACTS).forEach((extract) => {
        const text = String(extract.extract_text || '').slice(0, MAX_EXTRACT_CHARS);
        lines.push(`    * Paragraph: ${extract.paragraph_ref || 'no paragraph reference'}`);
        lines.push(`      EXACT TEXT: ${text}`);
        lines.push(`      PROPOSITION WE RELY ON: ${extract.proposition || 'not stated'}`);
      });
    }

    return lines.join('\n');
  });

  return `\n\n## MAIN AUTHORITIES - cite these first, in this order\n${blocks.join('\n\n')}`;
}