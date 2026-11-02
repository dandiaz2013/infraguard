// Documents the record refers to but that have not been uploaded. Only real documents:
// a type plus a date, a judge, a case number or a neutral citation. Merged, auto-matched
// to uploads, and never a sentence fragment.
import { normalise } from '@/lib/authorityCheck';
import { COURT_CATEGORIES } from '@/lib/documentType';
import { ROLE_LABELS } from '@/lib/recordIndex';
import { formatDate, toIsoDate } from '@/lib/documentDate';
import { clip } from '@/lib/recordIndex';

const DATE_SRC =
  '\\d{1,2}(?:st|nd|rd|th)?\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4}';

const TYPE_WORDS =
  'judgment|judgement|order|witness statement|transcript|skeleton argument|application notice|N244|claim form|particulars of claim|defence|notice of appeal|exhibit';

const TYPE_LABEL = {
  judgment: 'Judgment',
  judgement: 'Judgment',
  order: 'Order',
  'witness statement': 'Witness statement',
  transcript: 'Transcript',
  'skeleton argument': 'Skeleton argument',
  'application notice': 'Application notice',
  n244: 'Application notice',
  'claim form': 'Claim form',
  'particulars of claim': 'Particulars of claim',
  defence: 'Defence',
  'notice of appeal': 'Notice of appeal',
  exhibit: 'Exhibit'
};

const CATEGORY_FOR = {
  Judgment: 'Judgments',
  Order: 'Orders',
  'Witness statement': 'Witness statements',
  Transcript: 'Transcripts',
  'Skeleton argument': 'Skeleton arguments',
  'Application notice': 'Application notices',
  Exhibit: 'Exhibits'
};

const NEUTRAL =
  '\\[\\d{4}\\]\\s?(?:UKSC|UKHL|UKPC|EWCA|EWHC|EWFC|EWCOP|EWCR|UKUT|UKFTT|NICA|NIEHC)\\s?\\d+(?:\\s*\\([A-Za-z]{1,4}\\))?';

const JUDGE =
  "(?:Master|District Judge|Deputy District Judge|HHJ|His Honour Judge|Her Honour Judge|Mr Justice|Mrs Justice|Lord Justice|Lady Justice|Recorder)(?:\\s+[A-Z][A-Za-z.\\u2019'\\-]+){1,3}";

const WITH_DATE = new RegExp(
  `\\b(${TYPE_WORDS})\\b(?:\\s+of)?\\s*(${JUDGE})?\\s*(?:,?\\s*(?:dated|of)\\s*:?\\s*)(${DATE_SRC})`,
  'gi'
);
const WITH_JUDGE = new RegExp(`\\b(${TYPE_WORDS})\\b\\s+of\\s+(${JUDGE})`, 'gi');
const WITH_CITATION = new RegExp(`\\b(judgment|judgement|order)\\b[^.]{0,80}?(${NEUTRAL})`, 'gi');

function keyFor(parts) {
  return normalise(
    [parts.type, parts.date || '', parts.citation || '', parts.case_number || '', parts.judge || ''].join(' ')
  );
}

function labelFor(parts) {
  const bits = [parts.type];
  if (parts.judge) bits.push(`of ${parts.judge}`);
  if (parts.date) bits.push(`dated ${formatDate(parts.date) || parts.date}`);
  if (parts.citation) bits.push(parts.citation);
  return bits.join(' ');
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uploadedMatch(parts, documents) {
  const wantedCategory = CATEGORY_FOR[parts.type];
  return (
    documents.find((doc) => {
      const bothCourt =
        COURT_CATEGORIES.includes(wantedCategory) && COURT_CATEGORIES.includes(doc.category || '');
      if (wantedCategory && doc.category && doc.category !== wantedCategory && !bothCourt) return false;
      const text = String(doc.text || '');
      const docDate = doc.doc_date || doc.filed_date || '';
      if (parts.citation && new RegExp(escapeRe(parts.citation), 'i').test(text)) return true;
      if (parts.date && docDate && docDate === parts.date) return true;
      if (parts.case_number && text.toLowerCase().includes(String(parts.case_number).toLowerCase())) return true;
      return false;
    }) || null
  );
}

export function detectMissingDocuments(record) {
  const documents = record?.documents || [];
  const found = new Map();

  const add = (parts, segment) => {
    const type = TYPE_LABEL[String(parts.type).toLowerCase()] || parts.type;
    const clean = { ...parts, type };
    if (!clean.date && !clean.citation && !clean.judge && !clean.case_number) return;
    const key = keyFor(clean);
    if (!key) return;
    if (!found.has(key)) {
      found.set(key, {
        id: `referred-${key.replace(/\s+/g, '-').slice(0, 50)}`,
        label: labelFor(clean),
        type: clean.type,
        date: clean.date || '',
        judge: clean.judge || '',
        citation: clean.citation || '',
        case_number: clean.case_number || '',
        refs: []
      });
    }
    const entry = found.get(key);
    if (segment && !entry.refs.some((ref) => ref.document_name === segment.document_name && ref.ref === segment.ref)) {
      entry.refs.push({
        document_name: segment.document_name,
        ref: segment.ref,
        role: segment.role,
        who_label: ROLE_LABELS[segment.role] || segment.role || 'Party not recorded',
        quote: clip(segment.text, 200)
      });
    }
  };

  (record?.segments || []).forEach((segment) => {
    const text = segment.text;

    WITH_DATE.lastIndex = 0;
    let match;
    while ((match = WITH_DATE.exec(text)) !== null) {
      add({ type: match[1], judge: (match[2] || '').trim(), date: toIsoDate(match[3]) }, segment);
    }

    WITH_JUDGE.lastIndex = 0;
    while ((match = WITH_JUDGE.exec(text)) !== null) {
      add({ type: match[1], judge: match[2].trim() }, segment);
    }

    WITH_CITATION.lastIndex = 0;
    while ((match = WITH_CITATION.exec(text)) !== null) {
      add({ type: match[1], citation: match[2].replace(/\s+/g, ' ').trim() }, segment);
    }
  });

  return [...found.values()]
    .map((entry) => {
      const matched = uploadedMatch(entry, documents);
      return {
        ...entry,
        matched,
        status: matched ? `In the file: ${matched.name}` : 'Not uploaded',
        document_name: entry.refs[0]?.document_name || '',
        ref: entry.refs[0]?.ref || '',
        quote: entry.refs[0]?.quote || '',
        who_label: entry.refs[0]?.who_label || ''
      };
    })
    .filter((entry) => !entry.matched)
    .slice(0, 14);
}