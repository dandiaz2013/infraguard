// Section-by-section drafting support. The record paragraphs a section needs are
// resolved from the FULL document text, so a paragraph that sits beyond the first
// few thousand characters is still sent to the model in full. Everything the draft
// claims is then checked back against the record in code.
import { findParagraph, resolveDocumentRefs, checkDocumentQuotes } from '@/lib/docReferences';
import { resolveLineRef } from '@/lib/transcript';
import { normalise } from '@/lib/authorityCheck';

export const MARKER_KINDS = [
  'FACT NEEDED',
  'NO EXTRACT',
  'EXTRACT NEEDED',
  'USER STATEMENT - NO DOCUMENT REFERENCE',
  'RULE TEXT NEEDED',
  'WRONG SOURCE',
  'UNSUPPORTED',
  'CHECK AGAINST EXTRACT',
];

const MARKER_RE = new RegExp(`\\[(${MARKER_KINDS.join('|')})[^\\]]{0,160}\\]`, 'g');

export function collectMarkers(text = '') {
  const found = [];
  const seen = new Set();
  let match;
  MARKER_RE.lastIndex = 0;
  while ((match = MARKER_RE.exec(String(text || ''))) !== null) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    found.push({ kind: match[1], text: raw });
  }
  return found;
}

export function wordCount(text = '') {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export function sectionPlan(gateway = []) {
  return [
    { key: 'intro', title: 'Introduction and one-page summary', kind: 'narrative' },
    ...gateway.map((issue) => ({
      key: `issue:${issue.id}`,
      title: `${issue.number}. ${issue.title}`,
      kind: 'issue',
      issue,
    })),
    { key: 'responses', title: 'Anticipated responses', kind: 'narrative' },
    { key: 'relief', title: 'Relief sought', kind: 'narrative' },
    { key: 'markers', title: 'Open markers, unchecked authorities and unsupported points', kind: 'markers' },
  ];
}

function documentEntry(documents = [], name = '') {
  return documents.find(
    (entry) => entry.name === name || entry.file_name === name || String(entry.id) === String(name)
  );
}

function documentText(documents = [], name = '') {
  const doc = documentEntry(documents, name);
  return doc ? String(doc.text || '') : '';
}

function paragraphNumber(ref = '') {
  const match = String(ref || '').match(/(?:para(?:graph)?\s*)?(\d{1,3})\s*(?:\(([ivx]{1,4})\))?/i);
  if (!match) return null;
  return Number(match[1]);
}

// The full text of one record paragraph or transcript line range.
export function resolveRecordBlock({ document_name, ref }, documents = []) {
  const doc = documentEntry(documents, document_name);
  const text = doc ? String(doc.text || '') : '';
  if (!text) return null;
  const document_id = doc.id || '';
  const reference = String(ref || '');

  if (/\bp\.?\s*\d{1,3}/i.test(reference) && /lines?/i.test(reference)) {
    const resolved = resolveLineRef(text, reference);
    return resolved.found
      ? { document_id, document_name, ref: reference, text: resolved.text }
      : null;
  }

  const number = paragraphNumber(reference);
  if (number) {
    // Read from the whole document, so a paragraph beyond the first few thousand
    // characters is returned in full.
    const found = findParagraph(text, number);
    if (found.status === 'found') {
      return { document_id, document_name, ref: `para ${number}`, text: found.text };
    }
  }

  const needle = normalise(reference).slice(0, 60);
  if (needle.length > 12) {
    const at = normalise(text).indexOf(needle);
    if (at >= 0) {
      const raw = text.slice(Math.max(0, at - 200), at + 600).trim();
      return { document_id, document_name, ref: reference, text: raw };
    }
  }
  return null;
}

function keywordsFor(issue = {}) {
  return [
    ...new Set(
      normalise(`${issue.title || ''} ${issue.ask || ''} ${issue.gap || ''}`)
        .split(' ')
        .filter((word) => word.length > 4)
    ),
  ].slice(0, 6);
}

// Every record paragraph relevant to one gateway issue, in full.
export function issueRecordBlocks(issue = {}, documents = [], record = {}) {
  const blocks = [];
  const seen = new Set();
  const add = (block) => {
    if (!block) return;
    const key = `${block.document_name}::${block.ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(block);
  };

  [issue.ours, issue.theirs].filter(Boolean).forEach((answer) => {
    add(resolveRecordBlock({ document_name: answer.document_name, ref: answer.ref }, documents));
  });

  const words = keywordsFor(issue);
  (record?.segments || [])
    .map((segment) => ({
      segment,
      score: words.filter((word) => normalise(segment.text).includes(word)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .forEach((entry) => {
      add({
        document_id: documentEntry(documents, entry.segment.document_name)?.id || '',
        document_name: entry.segment.document_name,
        ref: entry.segment.ref,
        text: entry.segment.text,
      });
    });

  return blocks;
}

// What the draft says, checked against the record in code.
export function verifySection(text = '', documents = [], extracts = []) {
  const references = resolveDocumentRefs(text, documents);
  const quotes = checkDocumentQuotes(text, documents, extracts);
  const markers = collectMarkers(text);
  return {
    references: references.length,
    unresolved: references.filter((row) => row.status !== 'found').length,
    quotes: quotes.filter((entry) => entry.status !== 'authority').length,
    mismatched: quotes.filter((entry) => entry.status === 'mismatch').length,
    user_statements: markers.filter((marker) => marker.kind === 'USER STATEMENT - NO DOCUMENT REFERENCE').length,
    markers,
  };
}

export function assembleDraft(sections = []) {
  return sections
    .filter((section) => section.content && section.section_key !== 'markers')
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join('\n\n');
}

export function markerSummary(sections = []) {
  return sections
    .flatMap((section) => collectMarkers(section.content || '').map((marker) => ({ ...marker, section: section.title })))
    .filter(
      (entry, index, all) =>
        all.findIndex((other) => other.text === entry.text && other.section === entry.section) === index
    );
}

export function sectionProgress(sections = [], plan = []) {
  const drafted = plan.filter((entry) => (sections.find((s) => s.section_key === entry.key)?.content || '').trim());
  return {
    drafted: drafted.length,
    total: plan.length,
    locked: sections.filter((section) => section.locked).length,
  };
}