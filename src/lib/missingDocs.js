// Missing record detector. Lists the documents the record refers to that are not
// uploaded, with who refers to it and at which paragraph.
import { normalise } from '@/lib/authorityCheck';
import { ROLE_LABELS } from '@/lib/recordIndex';

const DOC_REF =
  /\b(the\s+|((?:first|second|third|fourth|fifth|sixth|seventh|eighth)\s+))?(witness statement|judgment|judgement|order|transcript|skeleton argument|bundle|application notice|N244|reasons|ruling|exhibit)\b(?:\s+(of|dated|at|by)\s+([A-Z0-9][\w'’.\s-]{0,32}))?/gi;

const OPINION = /\b(?:in|my|his|her|its|their)\s+$/i;

const EXHIBIT_REF = /\b(exhibit|bundle)\s+([A-Z]{1,3}\d{0,3}|[A-Z][a-z]{2,12})\b/gi;

function uploadedNames(record) {
  return (record?.documents || []).map((doc) => normalise(doc.name)).filter(Boolean);
}

function isUploaded(label, names) {
  const target = normalise(label).replace(/\b(the|of|at|in|dated|by|his|her|their|our|its)\b/g, '').trim();
  if (!target) return true;
  const words = target.split(/\s+/).filter((word) => word.length > 3);
  return names.some((name) => words.length > 0 && words.every((word) => name.includes(word)));
}

export function detectMissingDocuments(record) {
  const names = uploadedNames(record);
  const found = new Map();

  (record?.segments || []).forEach((segment) => {
    const scan = (pattern, build) => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(segment.text)) !== null) {
        const before = segment.text.slice(Math.max(0, match.index - 14), match.index);
        if (pattern === DOC_REF && OPINION.test(before)) continue;
        const label = build(match);
        if (!label) continue;
        const clean = label.replace(/\s+/g, ' ').trim().replace(/[.,;:]$/, '');
        if (clean.length < 5) continue;
        if (isUploaded(clean, names)) continue;
        const key = normalise(clean);
        if (found.has(key)) return;
        found.set(key, {
          id: `missing-${key.replace(/\s+/g, '-').slice(0, 40)}`,
          label: clean,
          who: segment.role,
          who_label: ROLE_LABELS[segment.role] || segment.role || 'Party not recorded',
          document_name: segment.document_name,
          ref: segment.ref,
          quote: segment.text.slice(0, 220),
        });
      }
    };

    scan(DOC_REF, (match) => {
      const head = `${match[2] || ''}${match[3] || ''}`;
      const tail = match[5] ? ` ${match[4]} ${match[5]}` : '';
      return `${head}${tail}`;
    });
    scan(EXHIBIT_REF, (match) => `${match[1]} ${match[2]}`);
  });

  return [...found.values()].slice(0, 14);
}