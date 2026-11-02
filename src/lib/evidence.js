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

// The single sentence that carries the most of the asked-for terms and reads as an answer.
export function answerSentence(text, terms = []) {
  const list = terms.map((term) => term.toLowerCase()).filter(Boolean);
  if (!list.length) return '';
  const candidates = sentences(text)
    .map((sentence) => ({
      sentence,
      hits: hitsIn(sentence, list).length
    }))
    .filter((entry) => entry.hits > 0 && VERB.test(entry.sentence));
  if (!candidates.length) return '';
  candidates.sort((a, b) => b.hits - a.hits || a.sentence.length - b.sentence.length);
  return clip(candidates[0].sentence, 220);
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