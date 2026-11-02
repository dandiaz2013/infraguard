// Deterministic paragraph splitter for pasted plain text. Rules only, no AI.
// Markers recognised at the start of a line: [12], 12. and para 12 / paragraph 12.

const MARKER = /^[ \t]*(?:\[(\d{1,3})\]|(\d{1,3})\.(?!\d)|(?:para|paragraph)\.?[ \t]*(\d{1,3})(?:[ \t]*[-–][ \t]*(\d{1,3}))?)[ \t]*[.:)]?[ \t]*(.*)$/i;

export function splitParagraphs(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const match = line.match(MARKER);
    if (match) {
      const start = Number(match[1] || match[2] || match[3]);
      const end = match[4] ? Number(match[4]) : null;
      current = {
        paragraph_ref: end ? `paras ${start}-${end}` : `para ${start}`,
        text: (match[5] || '').trim(),
      };
      blocks.push(current);
      continue;
    }

    if (current) {
      current.text = current.text ? `${current.text}\n${line.trim()}` : line.trim();
    } else {
      current = { paragraph_ref: '', text: line.trim() };
      blocks.push(current);
    }
  }

  return blocks.filter((block) => block.text.trim());
}

export function emptyExtractRow() {
  return { paragraph_ref: '', text: '', proposition: '' };
}