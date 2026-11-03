// Deterministic paragraph splitter for pasted plain text. Rules only, no AI.
// Markers recognised at the start of a line: [12], 12. and para 12 / paragraph 12.
// Sub-paragraphs (i), (ii), (a) are stored against the paragraph they sit under, e.g. "para 39(ii)".

const MARKER = /^[ \t]*(?:\[(\d{1,3})\]|(\d{1,3})\.(?!\d)|(?:para|paragraph)\.?[ \t]*(\d{1,3})(?:[ \t]*[-–][ \t]*(\d{1,3}))?)[ \t]*[.:)]?[ \t]*(.*)$/i;
const SUB_MARK = /^[ \t]*\(([A-Za-z]{1,6})\)[ \t]*(.*)$/;
const ROMAN = /^(?:i{1,3}|iv|v|vi{0,3}|ix|x)$/i;

export function isSubMarker(token = '') {
  const value = String(token).trim();
  if (!value) return false;
  if (ROMAN.test(value)) return true;
  return /^[a-z]$/i.test(value);
}

// The bare printed form of a reference, e.g. "39(ii)" from "para 39(ii)".
export function normaliseRef(ref = '') {
  return String(ref || '')
    .replace(/^paras?\s*/i, '')
    .replace(/[.\s]+$/, '')
    .trim();
}

export function splitParagraphs(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let current = null;
  let lastNumber = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const match = line.match(MARKER);
    if (match) {
      const start = Number(match[1] || match[2] || match[3]);
      const end = match[4] ? Number(match[4]) : null;
      lastNumber = start;
      current = {
        paragraph_ref: end ? `paras ${start}-${end}` : `para ${start}`,
        paragraph_number: start,
        text: (match[5] || '').trim(),
      };
      blocks.push(current);
      continue;
    }

    const sub = line.match(SUB_MARK);
    if (sub && isSubMarker(sub[1]) && lastNumber !== null) {
      current = {
        paragraph_ref: `para ${lastNumber}(${sub[1].toLowerCase()})`,
        paragraph_number: lastNumber,
        sub_ref: `${lastNumber}(${sub[1].toLowerCase()})`,
        text: (sub[2] || '').trim(),
      };
      blocks.push(current);
      continue;
    }

    if (current) {
      current.text = current.text ? `${current.text}\n${line.trim()}` : line.trim();
    } else {
      current = { paragraph_ref: '', paragraph_number: null, text: line.trim() };
      blocks.push(current);
    }
  }

  return blocks.filter((block) => block.text.trim());
}

export function emptyExtractRow() {
  return { paragraph_ref: '', text: '', proposition: '' };
}