// Shared rules for main authorities, used by every drafting function.
// A quotation may only come from a stored extract.

const MAX_AUTHORITIES = 20;
const MAX_EXTRACTS = 12;
const MAX_EXTRACT_CHARS = 1200;

export const MAIN_AUTHORITY_RULES = `## Main authorities - absolute rules
- Quote ONLY from an extract whose status is EXTRACT CHECKED, and copy the wording character for character.
- With every quotation give the case name, the neutral citation and the paragraph reference exactly as printed, including any sub-paragraph such as 39(ii).
- An extract marked PROPOSED - NOT CHECKED may be used only with [UNCHECKED EXTRACT] written immediately after the quotation.
- Never state the content of an authority from memory, and never write a paragraph number or a quotation that is not stored in an extract.
- A main authority with no extract: cite the case name and neutral citation only, then add [NO EXTRACT - PARAGRAPH NEEDED].
- A main authority whose extracts are not checked: write [NOT CHECKED - VERIFY BEFORE USE] at every place you cite it.
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
        const checked = extract.status
          ? String(extract.status).trim().toLowerCase().startsWith('extract checked')
          : true;
        lines.push(`    * Paragraph: ${extract.paragraph_ref || 'no paragraph reference'}`);
        lines.push(`      STATUS: ${checked ? 'EXTRACT CHECKED - quotable' : 'PROPOSED - NOT CHECKED'}`);
        lines.push(`      EXACT TEXT: ${text}`);
        lines.push(`      PROPOSITION WE RELY ON: ${extract.proposition || 'not stated'}`);
      });
    }

    return lines.join('\n');
  });

  return `\n\n## MAIN AUTHORITIES - cite these first, in this order\n${blocks.join('\n\n')}`;
}