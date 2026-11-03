// Classifies what the user typed under the fact fields. A statement that is really an
// argument, objection or comment on the other side is stored as our position, not a fact.
// Any note that objects to, rejects or criticises something is our position, not a fact.
const POSITION =
  /\b(i (?:submit|say|argue|contend|maintain)|we (?:submit|say|argue|contend|maintain)|should be (?:struck|excluded|disregarded|ignored)|must be (?:struck|excluded|disregarded)|not valid|is invalid|are invalid|invalid|not voluntary|not binding|fail(?:s|ed)? to|failure to|did not disclose|does not disclose|non-?disclosure|is wrong|are wrong|wrong|incorrect|misstates?|misleading|irrelevant|inadmissible|not credible|no weight|objection|i object|disputes?d?|cannot be relied|bad faith|abuse of process|contradicts?|unsupported|no basis|no evidence (?:for|of))\b/i;

function splitLines(text) {
  return String(text || '')
    .split(/\n+|(?<=\.)\s+(?=[A-Z])/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 0);
}

export function classifyNote(line) {
  const text = String(line || '').trim();
  if (!text) return { text, kind: 'empty' };
  const sentences = text.match(/[^.;:]+[.;:]*/g) || [text];
  const positionHits = sentences.filter((sentence) => POSITION.test(sentence)).length;
  const kind = positionHits > 0 && positionHits >= sentences.length / 2 ? 'position' : 'fact';
  return { text, kind };
}

export function classifyNotes(block) {
  return splitLines(block)
    .map(classifyNote)
    .filter((entry) => entry.kind !== 'empty');
}

export function positionLines(block) {
  return classifyNotes(block)
    .filter((entry) => entry.kind === 'position')
    .map((entry) => entry.text);
}