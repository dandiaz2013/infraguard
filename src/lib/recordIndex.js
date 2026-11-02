// Deterministic record index. No AI, no guessing.
// Every filed or served document is split into numbered paragraph / page / line
// segments, and the dates, statutes, regulations, CPR rules and cases mentioned in
// each segment are extracted with the exact sentence that mentions them.
import { normalise } from '@/lib/authorityCheck';

export const RECORD_STATUSES = ['Filed or served', 'Draft', 'Reference only'];
export const FILED_BY_OPTIONS = ['Ours', 'Other party', 'Court'];

export const ROLE_LABELS = {
  Court: 'Court',
  'Our side': 'Our side',
  'Other party': 'Other side',
  Unknown: 'Party not recorded',
};

const PARA_MARK = /^\s*(?:\[(\d{1,3})\]|(\d{1,3})[.)])\s*/;
const DECIMAL = /^\s*\d{1,3}\.\d/;
const PAGE_MARK = /^\s*(?:page|p\.?)\s*(\d{1,3})\b/i;
const MAX_SEGMENTS = 400;
const MAX_ITEMS = 600;

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const DATE_LONG = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\s+\\d{4}\\b`, 'g');
const DATE_SHORT = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
const STATUTE = /\b([A-Z][A-Za-z'’]*\s+(?:[A-Z][A-Za-z'’]*\s+){0,6}Act(?:\s+\d{4})?)\b/g;
const REGULATION = /\b([A-Z][A-Za-z'’]*\s+(?:[A-Z][A-Za-z'’]*\s+){0,6}Regulations?(?:\s+\d{4})?)\b/g;
const STATUTORY_INSTRUMENT = /\bSI\s?\d{4}\s?\/\s?\d+\b/g;
const CPR_RULE = /\bCPR\s?\d+(?:\.\d+)*(?:\([a-z0-9]+\))*/g;
const PRACTICE_DIRECTION = /\bPractice Direction\s?[A-Za-z0-9]*/g;
const CASE_NAME =
  /\b([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){0,4})\s+v\.?\s+([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){0,4})(?:\s*\[(\d{4})\]\s*([A-Z]{2,6}\s+\d+))?/g;

export const LAW_KINDS = ['statute', 'regulation', 'cpr', 'practice direction'];

export function clip(value, max = 320) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  if (source.length <= max) return source;
  const cut = source.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return space > 40 ? cut.slice(0, space) : cut;
}

export function quoteInText(quote, text) {
  const needle = normalise(quote);
  if (!needle) return false;
  return normalise(text).includes(needle);
}

export function datesIn(text) {
  const source = String(text || '');
  const found = [];
  [DATE_LONG, DATE_SHORT].forEach((pattern) => {
    pattern.lastIndex = 0;
    const matches = source.match(pattern) || [];
    matches.forEach((value) => found.push(value.trim()));
  });
  return [...new Set(found)];
}

export function yearsIn(text) {
  const found = String(text || '').match(/\b(1[89]\d{2}|20\d{2})\b/g) || [];
  return [...new Set(found)];
}

export function roleOf(document = {}) {
  const by = document.filed_by || '';
  if (by === 'Court') return 'Court';
  if (by === 'Other party') return 'Other party';
  if (by === 'Ours') return 'Our side';

  const category = document.category || '';
  const name = `${document.name || document.file_name || ''} ${document.document_type || ''}`;

  if (category === 'Previous judgments and orders') return 'Court';
  if (category === 'Our witness statement' || category === 'N244 and continuation sheet') return 'Our side';
  if (category === 'Other party witness statement') return 'Other party';
  if (/transcript|judgment|judgement|ruling|reasons|order\b/i.test(name)) return 'Court';
  if (/skeleton/i.test(name)) return 'Unknown';
  return 'Unknown';
}

function sentenceAt(text, index) {
  const source = String(text || '');
  const sentences = source.match(/[^.;:]+[.;:]+|[^.;:]+$/g) || [source];
  let cursor = 0;
  for (const sentence of sentences) {
    const start = source.indexOf(sentence, cursor);
    const end = start + sentence.length;
    cursor = end;
    if (start < 0) continue;
    if (index >= start && index <= end) return clip(sentence);
  }
  return clip(source);
}

function segmentList(blocks) {
  return blocks
    .map((block) => ({ ref: block.ref, text: String(block.lines.join(' ')).replace(/\s+/g, ' ').trim() }))
    .filter((block) => block.text.length > 1)
    .slice(0, MAX_SEGMENTS);
}

export function buildSegments(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const paragraphs = [];
  let current = null;
  let sawParagraph = false;

  for (const raw of lines) {
    if (DECIMAL.test(raw)) {
      if (current) current.lines.push(raw.trim());
      continue;
    }
    const marker = raw.match(PARA_MARK);
    if (marker) {
      sawParagraph = true;
      current = { ref: `para ${Number(marker[1] || marker[2])}`, lines: [] };
      const rest = raw.slice(marker[0].length).trim();
      if (rest) current.lines.push(rest);
      paragraphs.push(current);
      continue;
    }
    if (current) current.lines.push(raw.trim());
  }
  if (sawParagraph) return segmentList(paragraphs);

  const pages = [];
  let page = null;
  let sawPage = false;
  for (const raw of lines) {
    const marker = raw.match(PAGE_MARK);
    if (marker) {
      sawPage = true;
      page = { ref: `p.${Number(marker[1])}`, lines: [] };
      pages.push(page);
      continue;
    }
    if (page) page.lines.push(raw.trim());
  }
  if (sawPage) return segmentList(pages);

  const chunks = String(text || '')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const blocks = [];
  chunks.forEach((chunk, index) => {
    if (chunk.length <= 1500) {
      blocks.push({ ref: `Section ${index + 1}`, text: chunk });
      return;
    }
    const sentences = chunk.match(/[^.;:]+[.;:]+|[^.;:]+$/g) || [chunk];
    let buffer = '';
    let part = 1;
    sentences.forEach((sentence) => {
      if (buffer.length + sentence.length > 1200 && buffer) {
        blocks.push({ ref: `Section ${index + 1}.${part}`, text: buffer });
        buffer = '';
        part += 1;
      }
      buffer += sentence;
    });
    if (buffer.trim()) blocks.push({ ref: `Section ${index + 1}.${part}`, text: buffer });
  });

  return blocks
    .slice(0, MAX_SEGMENTS)
    .map((block) => ({ ref: block.ref, text: block.text.replace(/\s+/g, ' ').trim() }))
    .filter((block) => block.text.length > 1);
}

function itemsFromSegment(segment, doc, sink) {
  const add = (kind, label, index) => {
    const clean = String(label || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:the|a|an)\s+/i, '');
    if (clean.length < 4) return;
    sink.push({
      kind,
      label: clean,
      document_id: doc.id,
      document_name: doc.name,
      role: doc.role,
      ref: segment.ref,
      quote: sentenceAt(segment.text, index),
      segment_text: segment.text,
    });
  };

  const scan = (pattern, kind, build) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(segment.text)) !== null) {
      add(kind, build ? build(match) : match[0], match.index);
    }
  };

  scan(CASE_NAME, 'case', (match) =>
    `${match[1]} v ${match[2]}${match[3] ? ` [${match[3]}] ${match[4]}` : ''}`
  );
  scan(STATUTE, 'statute');
  scan(REGULATION, 'regulation');
  scan(STATUTORY_INSTRUMENT, 'regulation');
  scan(CPR_RULE, 'cpr');
  scan(PRACTICE_DIRECTION, 'practice direction');
  scan(DATE_LONG, 'date');
  scan(DATE_SHORT, 'date');
}

export function indexDocument(document = {}) {
  const doc = {
    id: document.id || document.name || 'document',
    name: document.name || document.file_name || 'Document',
    text: document.text || '',
  };
  doc.role = roleOf({ ...document, name: doc.name });
  doc.record_status = document.record_status || 'Filed or served';
  doc.filed_by = document.filed_by || '';
  doc.filed_date = document.filed_date || '';
  doc.exhibit_of = document.exhibit_of || '';

  const segments = buildSegments(doc.text);
  const items = [];
  const seen = new Set();

  segments.forEach((segment) => {
    const found = [];
    itemsFromSegment(segment, doc, found);
    found.forEach((item) => {
      const key = `${item.kind}:${normalise(item.label)}:${item.ref}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    });
  });

  return {
    id: doc.id,
    name: doc.name,
    text: doc.text,
    role: doc.role,
    record_status: doc.record_status,
    filed_by: doc.filed_by,
    filed_date: doc.filed_date,
    exhibit_of: doc.exhibit_of,
    segments,
    items: items.slice(0, MAX_ITEMS),
    segment_count: segments.length,
    law_items: items.filter((item) => LAW_KINDS.includes(item.kind)),
  };
}

export function buildRecord(documents = []) {
  const indexed = (documents || [])
    .filter((document) => String(document.text || '').trim().length > 0)
    .map(indexDocument);

  const segments = indexed.flatMap((doc) =>
    doc.segments.map((segment) => ({
      document_id: doc.id,
      document_name: doc.name,
      role: doc.role,
      record_status: doc.record_status,
      ref: segment.ref,
      text: segment.text,
      norm: normalise(segment.text),
    }))
  );

  return {
    documents: indexed,
    record_documents: indexed.filter((doc) => doc.record_status !== 'Reference only'),
    segments,
    items: indexed.flatMap((doc) => doc.items),
    searched: indexed.map((doc) => doc.name),
    text: indexed.map((doc) => doc.text).join('\n\n'),
    is_empty: indexed.length === 0,
  };
}