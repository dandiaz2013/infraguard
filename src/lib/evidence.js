// One answer per question, quoted from the paragraph that answers it. Deterministic.
// A quotation is only returned when the sentence itself carries the point: no generic
// "the court considered the matter" lines.
import { normalise } from '@/lib/authorityCheck';
import { clip } from '@/lib/recordIndex';

const VERB =
  /\b(is|are|was|were|has|have|had|did|does|do|will|would|can|could|must|shall|may|says|said|states|stated|sets out|found|held|holds|ordered|orders|applies|applied|seeks|seek|fails|failed|refused|dismissed|vary|varies|revoked?|reopen|set aside|knew|knows|know|aware|notified|informed|changed|turned|decided|concluded|submitted|contends|contended|denies|accepted|agreed|explains?|explained|provides?|requires?)\b/i;

export function sentences(text = '') {
  return String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;:])\s+(?=[A-Z(“"'])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function hitsIn(sentence, terms) {
  const lower = sentence.toLowerCase();
  return terms.filter((term) => lower.includes(term));
}

// A long run of text with no full stop (a letter heading, a form preamble) is cut at the
// point the wording starts again, so the quotation is one sentence and not a fragment.
function splitLong(sentence) {
  return sentence
    .split(/(?<=[0-9]{4}|[.):;])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 15);
}

// If the answer is still long, keep the clause that carries the point and stop at the end
// of that sentence: one line, never a fragment of a heading.
function trimToHit(sentence, hits) {
  if (sentence.length <= 200) return sentence;
  const lower = sentence.toLowerCase();
  const positions = hits.map((hit) => lower.indexOf(hit)).filter((index) => index >= 0);
  const first = positions.length ? Math.min(...positions) : 0;
  const before = sentence.slice(0, first);
  const boundary = Math.max(before.lastIndexOf('. '), before.lastIndexOf(': '), before.lastIndexOf('; '));
  const start = boundary >= 0 ? boundary + 2 : Math.max(0, first - 90);
  const rest = sentence.slice(start).trim();
  const endMatch = rest.search(/[.!?](\s|$)/);
  return endMatch > 60 ? rest.slice(0, endMatch + 1).trim() : rest;
}

// The single sentence that carries the most of the asked-for terms and reads as an answer.
export function answerSentence(text, terms = []) {
  const list = terms.map((term) => term.toLowerCase()).filter(Boolean);
  if (!list.length) return '';
  const candidates = sentences(text)
    .flatMap((sentence) => splitLong(sentence))
    .map((sentence) => ({
      sentence,
      hits: hitsIn(sentence, list).length
    }))
    .filter((entry) => entry.hits > 0 && VERB.test(entry.sentence));
  if (!candidates.length) return '';
  candidates.sort((a, b) => b.hits - a.hits || a.sentence.length - b.sentence.length);
  return clip(trimToHit(candidates[0].sentence, list), 220);
}

// spec: { terms, roles, categories, minHits }
export function findAnswer(record, spec = {}) {
  const terms = (spec.terms || []).map((term) => term.toLowerCase()).filter(Boolean);
  if (!record || terms.length === 0) return null;
  const minHits = spec.minHits || 1;

  let best = null;
  (record.documents || []).forEach((doc) => {
    if (spec.roles && !spec.roles.includes(doc.role)) return;
    if (spec.categories && !spec.categories.includes(doc.category)) return;
    if (spec.exclude_documents && spec.exclude_documents.includes(doc.name)) return;

    (doc.segments || []).forEach((segment) => {
      const quote = answerSentence(segment.text, terms);
      if (!quote) return;
      const hits = hitsIn(quote, terms).length;
      if (hits < minHits) return;
      const score = hits * 10 + Math.min(segment.text.length, 400) / 40;
      if (!best || score > best.score) {
        best = {
          score,
          hits,
          quote,
          document_name: doc.name,
          document_id: doc.id,
          category: doc.category,
          role: doc.role,
          ref: segment.ref,
          date: doc.doc_date || doc.filed_date || ''
        };
      }
    });
  });

  return best;
}

export function storedExtractFor(extracts = [], pattern) {
  const found = (extracts || []).find((extract) => pattern.test(String(extract.extract_text || '')));
  if (!found) return null;
  return {
    case_law_id: found.case_law_id,
    paragraph_ref: found.paragraph_ref || '',
    quote: clip(found.extract_text, 220)
  };
}