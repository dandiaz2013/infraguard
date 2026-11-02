// What changed in the draft, tied to each answered register item.
import { normalise } from '@/lib/authorityCheck';
import { clip } from '@/lib/recordIndex';

export const USER_STATEMENT_MARK = '[USER STATEMENT - NO DOCUMENT REFERENCE]';
const CONFLICT_MARK = /\[CONFLICT:[^\]]*\]/g;
const OPEN_MARKER = /\[(?:FACT NEEDED|EXTRACT NEEDED|RULE TEXT NEEDED|DOCUMENT REFERENCE NEEDED|AUTHORITY NEEDED)[^\]]*\]/gi;

export function compareDraft(text, items = []) {
  const norm = normalise(text || '');
  return (items || [])
    .filter((item) => item.answer?.answer || (item.evidence || []).length > 0)
    .map((item) => {
      const evidence = (item.evidence || [])[0];
      const quoteKey = evidence ? normalise(clip(evidence.quote, 60)) : '';
      const refKey = evidence ? normalise(`${evidence.document_name} ${evidence.ref}`) : '';
      const included = Boolean(quoteKey && norm.includes(quoteKey)) || Boolean(refKey && norm.includes(refKey));
      return {
        id: item.id,
        title: item.title,
        status: included ? 'in the draft' : 'not in the draft yet',
        why: evidence ? `${evidence.document_name}, ${evidence.ref}` : 'your answer',
      };
    });
}

export function draftMarks(text) {
  const source = String(text || '');
  const conflicts = source.match(CONFLICT_MARK) || [];
  const open = source.match(OPEN_MARKER) || [];
  const userStatements = (source.match(new RegExp(USER_STATEMENT_MARK.replace(/[[\]]/g, '\\$&'), 'g')) || []).length;
  return { conflicts: conflicts.length, open: open.length, userStatements };
}