import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Deterministic citation parser - regular expressions and string offsets only, no AI.
const CITATION_SOURCE = '\\[\\d{4}\\]\\s+(UKSC|UKPC|EWCA\\s+Civ|EWCA\\s+Crim|EWHC)\\s+\\d+(\\s+\\([A-Za-z]+\\))?';

const COURT_BY_CODE = {
  UKSC: 'Supreme Court',
  UKPC: 'Privy Council',
  'EWCA Civ': 'Court of Appeal (Civil Division)',
  'EWCA Crim': 'Court of Appeal (Criminal Division)',
  EWHC: 'High Court',
};

const STOP_OPENERS = ['The', 'This', 'That', 'It', 'In', 'As', 'If', 'Where', 'When'];
const MAX_CANDIDATES = 300;

const WORD_RE = /^[A-Z][A-Za-z'’&.\-]*$/;

function normaliseSpace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function findCitations(text) {
  const pattern = new RegExp(CITATION_SOURCE, 'g');
  const found = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const citation = normaliseSpace(match[0]);
    found.push({ citation, index: match.index, end: match.index + match[0].length });
  }
  return found;
}

function courtFor(citation) {
  const upper = citation.toUpperCase();
  if (upper.includes('UKSC')) return COURT_BY_CODE.UKSC;
  if (upper.includes('UKPC')) return COURT_BY_CODE.UKPC;
  if (upper.includes('EWCA CIV')) return COURT_BY_CODE['EWCA Civ'];
  if (upper.includes('EWCA CRIM')) return COURT_BY_CODE['EWCA Crim'];
  if (upper.includes('EWHC')) return COURT_BY_CODE.EWHC;
  return '';
}

function yearFor(citation) {
  const match = citation.match(/\[(\d{4})\]/);
  return match ? Number(match[1]) : null;
}

function collectLeft(text, vStart) {
  const before = text.slice(Math.max(0, vStart - 120), vStart);
  const words = before.split(/\s+/).filter(Boolean);
  const picked = [];
  for (let i = words.length - 1; i >= 0 && picked.length < 6; i -= 1) {
    if (!WORD_RE.test(words[i])) break;
    picked.unshift(words[i]);
  }
  while (picked.length > 1 && STOP_OPENERS.includes(picked[0])) picked.shift();
  if (picked.length === 0 || STOP_OPENERS.includes(picked[0])) return [];
  return picked;
}

function collectRight(text, vEnd) {
  const after = text.slice(vEnd, vEnd + 120);
  const words = after.split(/\s+/).filter(Boolean);
  const picked = [];
  for (const word of words) {
    if (picked.length >= 6) break;
    const clean = word.replace(/[,.;:)\]"'”’]+$/, '');
    if (!WORD_RE.test(clean)) break;
    picked.push(clean);
  }
  return picked;
}

function findCaseNames(text) {
  const results = [];
  const separator = /(^|[^A-Za-z])v\.?([^A-Za-z]|$)/g;
  let match;
  while ((match = separator.exec(text)) !== null) {
    const lead = match[1] || '';
    const vStart = match.index + lead.length;
    const hasDot = text.charAt(vStart + 1) === '.';
    const vEnd = vStart + (hasDot ? 2 : 1);

    const leftWords = collectLeft(text, vStart);
    const rightWords = collectRight(text, vEnd);
    if (leftWords.length === 0 || rightWords.length === 0) continue;

    const leftStr = leftWords.join(' ');
    const rightStr = rightWords.join(' ');
    const start = text.lastIndexOf(leftStr, vStart);
    const rightAt = text.indexOf(rightStr, vEnd);
    if (start < 0 || rightAt < 0) continue;

    results.push({
      name: `${leftStr} v ${rightStr}`,
      start,
      end: rightAt + rightStr.length,
    });
  }
  return results;
}

function findParagraphRef(text, start, end) {
  const windowStart = Math.max(0, start - 150);
  const windowEnd = Math.min(text.length, end + 150);
  const windowText = text.slice(windowStart, windowEnd);
  const para = windowText.match(/(?:paragraph|para)\.?\s*(\d{1,3}[A-Za-z\-]*)/i);
  if (para) return `para ${para[1]}`;
  const bracket = windowText.match(/\[(\d{1,3})\]/);
  if (bracket) return `[${bracket[1]}]`;
  return '';
}

function excerptFor(text, start, end) {
  const from = Math.max(0, start - 150);
  const to = Math.min(text.length, end + 150);
  return normaliseSpace(text.slice(from, to));
}

function buildCandidate(text, name, citation, start, end) {
  return {
    name,
    neutral_citation: citation,
    court: citation ? courtFor(citation) : '',
    year: citation ? yearFor(citation) : null,
    paragraph_ref: findParagraphRef(text, start, end),
    excerpt: excerptFor(text, start, end),
  };
}

function extractCandidates(text) {
  const citations = findCitations(text);
  const names = findCaseNames(text).sort((a, b) => a.start - b.start);

  const usedCitations = new Set();
  const seenKeys = new Set();
  const candidates = [];

  for (const entry of names) {
    const linked = citations.find(
      (citation) =>
        citation.index >= entry.end &&
        citation.index - entry.end <= 80 &&
        !usedCitations.has(citation.citation.toLowerCase())
    );
    if (linked && usedCitations.has(linked.citation.toLowerCase())) continue;

    const citation = linked ? linked.citation : '';
    const key = citation ? `c:${citation.toLowerCase()}` : `n:${entry.name.toLowerCase()}`;
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    if (citation) usedCitations.add(citation.toLowerCase());
    candidates.push({
      ...buildCandidate(text, entry.name, citation, entry.start, entry.end),
      position: entry.start,
    });
  }

  for (const citation of citations) {
    const lower = citation.citation.toLowerCase();
    if (usedCitations.has(lower)) continue;
    usedCitations.add(lower);
    const key = `c:${lower}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    candidates.push({
      ...buildCandidate(text, `Unknown - ${citation.citation}`, citation.citation, citation.index, citation.end),
      position: citation.index,
    });
  }

  return candidates
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_CANDIDATES)
    .map(({ position, ...candidate }) => candidate);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const judgmentId = typeof body.judgment_id === 'string' ? body.judgment_id : '';
    if (!judgmentId) return Response.json({ error: 'judgment_id is required' }, { status: 400 });

    const judgment = await base44.entities.Judgment.get(judgmentId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!judgment) return Response.json({ error: 'Judgment not found' }, { status: 404 });

    const rawText = typeof judgment.raw_text === 'string' ? judgment.raw_text : '';
    if (!rawText.trim()) {
      return Response.json(
        { error: 'This judgment has no text yet. Paste the judgment text before parsing.' },
        { status: 400 }
      );
    }

    // Preview: hand the candidates back for review, save nothing.
    if (!Array.isArray(body.candidates)) {
      const candidates = extractCandidates(rawText);
      return Response.json({ candidates, found: candidates.length });
    }

    // Confirm: create or match authorities, then record the citations.
    let found = 0;
    let matched = 0;
    let created = 0;
    let skipped = 0;
    let linked = 0;

    try {
      const existingCaseLaw = await base44.asServiceRole.entities.CaseLaw.filter({});
      const byCitation = new Map();
      const byName = new Map();
      existingCaseLaw.forEach((record) => {
        if (record.neutral_citation) byCitation.set(record.neutral_citation.toLowerCase().trim(), record);
        if (record.name) byName.set(record.name.toLowerCase().trim(), record);
      });

      const existingCitations = await base44.asServiceRole.entities.JudgmentCitation.filter({
        judgment_id: judgmentId,
      });

      const rows = body.candidates.slice(0, MAX_CANDIDATES);
      found = rows.length;

      for (const row of rows) {
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        const citation = typeof row.neutral_citation === 'string' ? row.neutral_citation.trim() : '';
        if (!name && !citation) {
          skipped += 1;
          continue;
        }

        const displayName = name || `Unknown - ${citation}`;
        try {
          let record = citation ? byCitation.get(citation.toLowerCase()) : null;
          if (!record) record = byName.get(displayName.toLowerCase()) || null;

          if (record) {
            matched += 1;
          } else {
            record = await base44.entities.CaseLaw.create({
              name: displayName,
              neutral_citation: citation,
              court: row.court || courtFor(citation),
              year: row.year || yearFor(citation) || undefined,
              url: judgment.source_url || '',
              source_note: `Parsed from judgment: ${judgment.title}`,
              verified: false,
            });
            created += 1;
            if (citation) byCitation.set(citation.toLowerCase(), record);
            byName.set(displayName.toLowerCase(), record);
          }

          const paragraphRef = row.paragraph_ref || '';
          const duplicate = existingCitations.some(
            (item) => item.case_law_id === record.id && (item.paragraph_ref || '') === paragraphRef
          );
          if (duplicate) {
            skipped += 1;
            continue;
          }

          const citationRecord = await base44.entities.JudgmentCitation.create({
            judgment_id: judgmentId,
            case_law_id: record.id,
            context_type: 'other',
            paragraph_ref: paragraphRef,
            excerpt: row.excerpt || '',
            note: '',
          });
          existingCitations.push(citationRecord);
          linked += 1;
        } catch (rowError) {
          skipped += 1;
        }
      }
    } catch (error) {
      await base44.entities.Judgment.update(judgmentId, {
        parse_status: 'failed',
        parse_log: `Parse failed: ${error.message}`,
      });
      return Response.json({ error: error.message }, { status: 500 });
    }

    const log = `Found ${found} candidate${found === 1 ? '' : 's'}: ${matched} matched existing authorit${matched === 1 ? 'y' : 'ies'}, ${created} created, ${skipped} skipped, ${linked} citation${linked === 1 ? '' : 's'} saved.`;

    await base44.entities.Judgment.update(judgmentId, {
      parse_status: 'parsed',
      parse_log: log,
    });

    return Response.json({ status: 'parsed', found, matched, created, skipped, linked, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}