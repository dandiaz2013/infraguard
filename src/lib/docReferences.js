// Deterministic resolver for structured document references. No AI, no guessing.
// References are written in the draft as:
//   {{DOC:<document_id>|para:<number or range>}}
//   {{DOC:<document_id>|page:<n>|lines:<a-b>}}
import { normalise, findQuotations } from '@/lib/authorityCheck';

const REF_RE = /\{\{DOC:([^|}]+)\|([^}]+)\}\}/g;
const MARKER_LINE = /^\s*(?:\[(\d{1,3})\]|(\d{1,3})[.)])\s*/;
const DECIMAL = /^\s*\d{1,3}\.\d/;
const PAGE_LINE = /^\s*(?:page|p\.?)\s*(\d{1,3})\b/i;

export function parseDocumentRefs(text) {
  const source = String(text || '');
  const found = [];
  REF_RE.lastIndex = 0;
  let match;
  while ((match = REF_RE.exec(source)) !== null) {
    found.push({ raw: match[0], document_id: match[1].trim(), spec: match[2].trim(), index: match.index });
  }
  return found;
}

export function hasDocumentRefs(text) {
  return parseDocumentRefs(text).length > 0;
}

export function stripDocumentRefs(text) {
  return String(text || '').replace(REF_RE, ' ');
}

export function parseSpec(spec) {
  const value = String(spec || '');
  const para = value.match(/paras?:?\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/i);
  if (para) {
    const from = Number(para[1]);
    return { kind: 'para', from, to: para[2] ? Number(para[2]) : from };
  }
  const page = value.match(/pages?:?\s*(\d{1,3})/i);
  const lines = value.match(/lines?:?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})/i);
  if (page) {
    return { kind: 'page', page: Number(page[1]), lines: lines ? [Number(lines[1]), Number(lines[2])] : null };
  }
  return { kind: 'unknown' };
}

export function formatSpec(spec) {
  if (spec.kind === 'para') return spec.from === spec.to ? `para ${spec.from}` : `paras ${spec.from}-${spec.to}`;
  if (spec.kind === 'page') return spec.lines ? `p.${spec.page}, ll.${spec.lines[0]}-${spec.lines[1]}` : `p.${spec.page}`;
  return 'unreadable reference';
}

export function formatRefLabel(name, spec) {
  return `${name}, ${formatSpec(spec)}`;
}

function numberedBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let current = null;

  for (const raw of lines) {
    if (DECIMAL.test(raw)) {
      if (current) current.lines.push(raw.trim());
      continue;
    }
    const marker = raw.match(MARKER_LINE);
    if (marker) {
      current = { number: Number(marker[1] || marker[2]), lines: [] };
      const rest = raw.slice(marker[0].length).trim();
      if (rest) current.lines.push(rest);
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(raw.trim());
  }

  return blocks;
}

// Built once per document pool so a whole draft can be matched against the record.
export function buildRecordBlocks(documents = []) {
  return (documents || [])
    .map((doc) => ({
      id: doc.id || '',
      name: doc.name || doc.file_name || 'document',
      flat: normalise(doc.text),
      blocks: numberedBlocks(doc.text)
        .map((block) => ({ number: block.number, text: block.lines.join(' ').trim() }))
        .filter((block) => block.text),
    }))
    .filter((doc) => doc.flat);
}

export function matchRecordBlocks(quote, blocks = []) {
  const norm = normalise(quote);
  if (!norm || norm.length < 12) return null;
  for (const doc of blocks || []) {
    const hit = doc.blocks.find((block) => normalise(block.text).includes(norm));
    if (hit) {
      return { document_id: doc.id, document_name: doc.name, reference: `para ${hit.number}`, text: hit.text };
    }
    if (doc.flat.includes(norm)) {
      return { document_id: doc.id, document_name: doc.name, reference: 'in the extracted text', text: '' };
    }
  }
  return null;
}

export function findRecordMatch(quote, documents = []) {
  return matchRecordBlocks(quote, buildRecordBlocks(documents));
}

export function findParagraph(text, number) {
  const blocks = numberedBlocks(text).filter((block) => block.number === Number(number));
  const texts = blocks.map((block) => block.lines.join(' ').trim()).filter(Boolean);
  if (texts.length === 0) return { status: 'missing', text: '', count: 0 };
  if (texts.length > 1) return { status: 'ambiguous', text: texts[0], count: texts.length };
  return { status: 'found', text: texts[0], count: 1 };
}

function findPage(text, page, lines) {
  const lines2 = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let current = null;
  for (const raw of lines2) {
    const marker = raw.match(PAGE_LINE);
    if (marker) {
      current = { page: Number(marker[1]), lines: [] };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(raw.trim());
  }
  const block = blocks.find((entry) => entry.page === Number(page));
  if (!block) return { status: 'missing', text: '' };
  const kept = lines ? block.lines.slice(lines[0] - 1, lines[1]) : block.lines;
  return { status: 'found', text: kept.join(' ').trim() };
}

function headingList(text) {
  const headings = [];
  const re = /^#{1,6}\s+(.+)$/gm;
  let match;
  while ((match = re.exec(String(text || ''))) !== null) {
    headings.push({ index: match.index, title: match[1].trim() });
  }
  return headings;
}

export function resolveDocumentRefs(text, documents = []) {
  const source = String(text || '');
  const byId = new Map((documents || []).map((doc) => [String(doc.id), doc]));
  const headings = headingList(source);

  return parseDocumentRefs(source).map((ref) => {
    const heading = [...headings].reverse().find((entry) => entry.index < ref.index);
    const spec = parseSpec(ref.spec);
    const base = {
      raw: ref.raw,
      document_id: ref.document_id,
      spec,
      reference: formatSpec(spec),
      used_in: heading ? heading.title : 'Draft',
    };

    const doc = byId.get(String(ref.document_id));
    if (!doc) {
      return {
        ...base,
        document_name: 'Unknown document',
        label: 'Unknown document',
        status: 'missing_document',
        statusLabel: 'Document not uploaded',
        text: '',
        detail: `The draft refers to document id "${ref.document_id}", which is not in this matter.`,
      };
    }

    const label = formatRefLabel(doc.name, spec);

    if (spec.kind === 'para') {
      const numbers = [];
      for (let value = spec.from; value <= spec.to; value += 1) numbers.push(value);
      const found = numbers.map((value) => findParagraph(doc.text, value));
      const missing = numbers.filter((value, index) => found[index].status === 'missing');
      const ambiguous = found.some((entry) => entry.status === 'ambiguous');
      const texts = found.filter((entry) => entry.text).map((entry) => entry.text);

      if (missing.length > 0) {
        return {
          ...base,
          document_name: doc.name,
          label,
          status: 'missing_paragraph',
          statusLabel: 'Paragraph not found in extracted text',
          text: '',
          detail: `Paragraph ${missing.join(', ')} could not be found in the extracted text of this document.`,
        };
      }
      if (ambiguous) {
        return {
          ...base,
          document_name: doc.name,
          label,
          status: 'ambiguous',
          statusLabel: 'Reference ambiguous',
          text: texts[0] || '',
          detail: 'More than one paragraph in the extracted text carries this number, so the reference is ambiguous.',
        };
      }
      return {
        ...base,
        document_name: doc.name,
        label,
        status: 'found',
        statusLabel: 'Found',
        text: texts.join(' '),
        detail: '',
      };
    }

    if (spec.kind === 'page') {
      const found = findPage(doc.text, spec.page, spec.lines);
      if (found.status === 'missing') {
        return {
          ...base,
          document_name: doc.name,
          label,
          status: 'missing_paragraph',
          statusLabel: 'Page not found in extracted text',
          text: '',
          detail: `Page ${spec.page} could not be found in the extracted text of this document.`,
        };
      }
      return {
        ...base,
        document_name: doc.name,
        label,
        status: 'found',
        statusLabel: 'Found',
        text: found.text,
        detail: '',
      };
    }

    return {
      ...base,
      document_name: doc.name,
      label,
      status: 'missing_paragraph',
      statusLabel: 'Reference unreadable',
      text: '',
      detail: 'The reference does not give a paragraph or a page.',
    };
  });
}

export function sourcePackRows(rows = []) {
  return rows
    .filter((row) => row.status === 'found' && row.text)
    .map((row) => ({
      document_name: row.document_name,
      reference: row.reference,
      text: row.text,
      used_in: row.used_in,
      label: row.label,
    }));
}

export function sourcePackText(rows = [], title = 'SOURCE PACK') {
  const lines = [title, ''];
  rows.forEach((row) => {
    lines.push(`${row.document_name} | ${row.reference} | used in: ${row.used_in}`);
    lines.push(row.text);
    lines.push('');
  });
  return lines.join('\n').trim();
}

function tokens(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3)
  );
}

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  a.forEach((word) => {
    if (b.has(word)) shared += 1;
  });
  return shared / Math.min(a.size, b.size);
}

export function checkDocumentQuotes(text, documents = [], extracts = []) {
  const docBlocks = buildRecordBlocks(documents);

  return findQuotations(text).map((quote) => {
    const norm = normalise(quote);

    if ((extracts || []).some((extract) => normalise(extract.extract_text).includes(norm))) {
      return { quote, status: 'authority', document_name: '', reference: '', text: '' };
    }

    const inRecord = matchRecordBlocks(quote, docBlocks);
    if (inRecord) {
      return {
        quote,
        status: 'match',
        document_name: inRecord.document_name,
        reference: inRecord.reference,
        text: inRecord.text,
      };
    }

    let best = null;
    for (const doc of docBlocks) {
      for (const block of doc.blocks) {
        const score = similarity(norm, normalise(block.text));
        if (!best || score > best.score) {
          best = { score, document_name: doc.name, reference: `para ${block.number}`, text: block.text };
        }
      }
    }

    return {
      quote,
      status: 'mismatch',
      document_name: best ? best.document_name : '',
      reference: best ? best.reference : '',
      text: best ? best.text : '',
      score: best ? best.score : 0,
    };
  });
}