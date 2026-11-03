// Deterministic record index. No AI, no guessing.
// Every filed or served document is split into numbered paragraph / page / line
// segments, and the dates, statutes, regulations, CPR rules and cases mentioned in
// each segment are extracted with the exact sentence that mentions them.
import { normalise } from '@/lib/authorityCheck';
import { classifyDocument, roleForCategory } from '@/lib/documentType';
import { dateFromDocument } from '@/lib/documentDate';
import { transcriptSegments } from '@/lib/transcript';

export const RECORD_STATUSES = ['Filed or served', 'Draft', 'Reference only'];
export const FILED_BY_OPTIONS = ['Ours', 'Other party', 'Court'];

export const ROLE_LABELS = {
  Court: 'Court',
  'Our side': 'Our side',
  'Other party': 'Other side',
  Unknown: 'Party not recorded',
};

const PARA_MARK =
  /^\s*(?:\[(\d{1,3})\]|(\d{1,3})(?:\(([a-z0-9ivx]{1,4})\))?[.)]\s*|(\d{1,3})(?:\(([a-z0-9ivx]{1,4})\))?[.)]?\s{2,}(?=[A-Z(“]))/;
const DECIMAL = /^\s*\d{1,3}\.\d/;
const PAGE_MARK = /^\s*(?:page|p\.?)\s*(\d{1,3})\b/i;
const STATEMENT =
  /\b(is|are|was|were|has|have|had|did|does|do|will|would|can|could|must|shall|may|apply|applies|seeks?|ordered|orders?|dismissed|refused|found|held|knew|knows?|aware|says?|said|states?|stated|contends?|denies|agrees?|accepted|provides?|requires?|directed|recovered|obtained|withdrawn|failed)\b/i;
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

// What a document is comes from the document itself. Only judgments, orders and
// transcripts are the Court: a letter, a witness statement or an application is a party.
export function roleOf(document = {}) {
  const verdict = classifyDocument({
    ...document,
    name: document.name || document.file_name,
    party: document.party || (document.filed_by === 'Other party' ? 'Other side' : '')
  });
  return roleForCategory(verdict.category, document.party || verdict.party);
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

function segmentize(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const paragraphs = [];
  const preamble = { ref: 'preamble', lines: [] };
  let current = null;
  let sawParagraph = false;
  let started = false;

  for (const raw of lines) {
    if (DECIMAL.test(raw)) {
      if (current) current.lines.push(raw.trim());
      continue;
    }
    const marker = raw.match(PARA_MARK);
    const rest = marker ? raw.slice(marker[0].length).trim() : '';
    // A numbered line is a paragraph only when it states something. An address list or a
    // numbered list of parties is not a paragraph.
    const statesSomething =
      Boolean(marker) &&
      (STATEMENT.test(rest) || (rest.length >= 25 && /[.!?]$/.test(rest)));
    if (statesSomething) {
      if (!started) {
        started = true;
        if (preamble.lines.join(' ').trim().length > 1) paragraphs.push(preamble);
      }
      sawParagraph = true;
      const number = Number(marker[1] || marker[2] || marker[4]);
      const sub = marker[3] || marker[5] || '';
      current = { ref: `para ${number}${sub ? `(${sub})` : ''}`, lines: [] };
      if (rest) current.lines.push(rest);
      paragraphs.push(current);
      continue;
    }
    if (current) current.lines.push(raw.trim());
    else preamble.lines.push(raw.trim());
  }
  if (sawParagraph) return { segments: segmentList(paragraphs), mode: 'paragraph' };

  // Transcripts are the only documents cited by page and line.
  const pages = [];
  let pageNo = null;
  let pageLines = [];
  for (const raw of lines) {
    const marker = raw.match(PAGE_MARK);
    if (marker) {
      if (pageNo !== null && pageLines.length) pages.push({ pageNo, pageLines });
      pageNo = Number(marker[1]);
      pageLines = [];
      continue;
    }
    if (pageNo !== null) pageLines.push(raw.trim());
  }
  if (pageNo !== null && pageLines.length) pages.push({ pageNo, pageLines });

  if (pages.length) {
    // Printed line numbers are used where the transcript shows them; otherwise the
    // lines are counted as they appear on the page.
    const printed = transcriptSegments(String(text || ''));
    if (printed.length) return { segments: printed.slice(0, MAX_SEGMENTS), mode: 'page' };

    const segments = [];
    pages.forEach((page) => {
      const filled = page.pageLines.filter((line) => line.length > 0);
      for (let start = 0; start < filled.length; start += 8) {
        const slice = filled.slice(start, start + 8);
        const from = start + 1;
        const to = start + slice.length;
        segments.push({
          ref: `p.${page.pageNo} lines ${from}-${to}`,
          text: slice.join(' ').replace(/\s+/g, ' ').trim(),
        });
      }
    });
    return {
      segments: segments.filter((block) => block.text.length > 1).slice(0, MAX_SEGMENTS),
      mode: 'page',
    };
  }

  // Letters and long unnumbered documents: split into real paragraphs, never one block.
  const chunks = String(text || '')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  let source = chunks;
  if (source.length <= 1) {
    const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
    if (nonEmpty.length > 3) source = nonEmpty;
  }
  if (source.length <= 1 && String(text).trim().length > 400) {
    const sentences = String(text).match(/[^.;:]+[.;:]+|[^.;:]+$/g) || [String(text)];
    source = [];
    let buffer = '';
    sentences.forEach((sentence) => {
      if (buffer.length + sentence.length > 500 && buffer.trim()) {
        source.push(buffer.trim());
        buffer = '';
      }
      buffer += sentence;
    });
    if (buffer.trim()) source.push(buffer.trim());
  }

  const blocks = [];
  source.forEach((chunk) => {
    if (chunk.length <= 900) {
      blocks.push(chunk);
      return;
    }
    const parts = chunk.match(/[^.;:]+[.;:]+|[^.;:]+$/g) || [chunk];
    let buffer = '';
    parts.forEach((sentence) => {
      if (buffer.length + sentence.length > 700 && buffer.trim()) {
        blocks.push(buffer.trim());
        buffer = '';
      }
      buffer += sentence;
    });
    if (buffer.trim()) blocks.push(buffer.trim());
  });

  return {
    segments: blocks
      .map((block, index) => ({ ref: `para ${index + 1}`, text: block.replace(/\s+/g, ' ').trim() }))
      .filter((block) => block.text.length > 1)
      .slice(0, MAX_SEGMENTS),
    mode: 'paragraph',
  };
}

export function buildSegments(text) {
  return segmentize(text).segments;
}

export function segmentMode(text) {
  return segmentize(text).mode;
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
  const verdict = classifyDocument({ ...document, name: doc.name, text: doc.text });
  doc.category = verdict.category;
  doc.party = verdict.party;
  doc.role = roleForCategory(verdict.category, verdict.party);
  doc.record_status = document.record_status || 'Filed or served';
  doc.filed_by = document.filed_by || '';
  doc.filed_date = document.document_date || document.filed_date || '';
  // A date the user confirmed is used. A detected date is kept for display only.
  const detected =
    dateFromDocument(doc.text, verdict.category) || dateFromDocument(doc.name, verdict.category) || '';
  const given = document.confirmed_date || document.document_date || doc.filed_date || '';
  doc.date_confirmed =
    document.date_confirmed === true ? true : document.date_confirmed === false ? false : undefined;
  doc.confirmed_date = given;
  doc.detected_date = detected;
  doc.doc_date = doc.date_confirmed === false ? '' : given || detected || '';
  doc.exhibit_of = document.exhibit_of || '';

  const built = segmentize(doc.text);
  const segments = built.segments;
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
    category: doc.category,
    party: doc.party,
    record_status: doc.record_status,
    filed_by: doc.filed_by,
    filed_date: doc.filed_date,
    doc_date: doc.doc_date,
    confirmed_date: doc.confirmed_date,
    date_confirmed: doc.date_confirmed,
    detected_date: doc.detected_date,
    exhibit_of: doc.exhibit_of,
    index_mode: built.mode,
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
      category: doc.category,
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