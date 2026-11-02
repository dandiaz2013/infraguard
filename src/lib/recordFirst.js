// Record-first resolution. Deterministic: keyword search over the indexed record,
// quotes verified against the extracted text before they are shown.
import { normalise } from '@/lib/authorityCheck';
import { LAW_KINDS, ROLE_LABELS, clip, datesIn, quoteInText } from '@/lib/recordIndex';

export const RECORD_SENTINEL = 'RECORD ·';

const STOP = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'which', 'there',
  'their', 'would', 'should', 'could', 'about', 'into', 'over', 'under', 'after', 'before',
  'between', 'other', 'than', 'then', 'they', 'them', 'your', 'ours', 'does', 'doing', 'made',
  'make', 'also', 'said', 'says', 'state', 'states', 'stated', 'document', 'documents',
  'paragraph', 'please', 'confirm', 'whether', 'because', 'where', 'while', 'these', 'those',
  'such', 'more', 'most', 'must', 'need', 'needs', 'only', 'same', 'some', 'very', 'will',
  'shall', 'upon', 'being', 'court', 'case', 'matter', 'order', 'orders',
]);

const RULING = /\b(i find|i hold|i am satisfied|in my judgment|in my view|it follows|the court (holds|finds|considers|is satisfied)|accordingly|I refuse|I allow|I dismiss|dismissed|allowed|ordered that|it is ordered|the (claim|application) (succeeds|fails))\b/i;
const IN_FORCE = /\b(in force|not in force|came into force|commencement|repealed|revoked|replaced|superseded|amended|regime|substituted)\b/i;

const DOC_SUPPORTED = new Set([
  'facts_supported', 'user_statements', 'misstatements', 'clauses', 'procedural', 'elements_covered',
]);

export function keyTerms(value) {
  const words = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
  return [...new Set(words)].slice(0, 12);
}

function pickQuote(text, hits) {
  const sentences = String(text || '').match(/[^.;:]+[.;:]+|[^.;:]+$/g) || [String(text || '')];
  let best = '';
  let bestHits = -1;
  sentences.forEach((sentence) => {
    const norm = normalise(sentence);
    const score = hits.filter((hit) => norm.includes(hit)).length;
    if (score > bestHits) {
      bestHits = score;
      best = sentence;
    }
  });
  return clip(best || text);
}

export function searchRecord(record, query, limit = 6) {
  const terms = keyTerms(query);
  if (!record || !record.segments || record.segments.length === 0 || terms.length === 0) {
    return { terms, matches: [] };
  }

  const stems = terms.map((term) => ({ term, stem: term.length >= 6 ? term.slice(0, 5) : term }));
  const matches = [];
  record.segments.forEach((segment) => {
    const norm = segment.norm || normalise(segment.text);
    const hits = stems.filter(({ stem }) => norm.includes(stem)).map(({ term }) => term);
    if (hits.length === 0) return;
    const score = hits.length / terms.length;
    if (score < 0.2) return;
    const quote = pickQuote(segment.text, hits);
    matches.push({
      document_id: segment.document_id,
      document_name: segment.document_name,
      role: segment.role,
      ref: segment.ref,
      text: segment.text,
      quote,
      verified: quoteInText(quote, segment.text),
      score,
      hits,
    });
  });

  matches.sort((a, b) => b.score - a.score || String(a.document_name).localeCompare(String(b.document_name)));
  return { terms, matches: matches.slice(0, limit) };
}

function detectConflict(matches) {
  const byRole = new Map();
  matches.forEach((match) => {
    if (match.role === 'Unknown') return;
    const found = datesIn(match.text);
    if (found.length === 0) return;
    const existing = byRole.get(match.role) || new Set();
    found.forEach((date) => existing.add(date));
    byRole.set(match.role, existing);
  });

  const roles = [...byRole.keys()];
  for (let i = 0; i < roles.length; i += 1) {
    for (let j = i + 1; j < roles.length; j += 1) {
      const left = [...byRole.get(roles[i])];
      const right = [...byRole.get(roles[j])];
      if (left.length === 0 || right.length === 0) continue;
      if (left.some((date) => right.includes(date))) continue;
      return { roles: [roles[i], roles[j]], left, right };
    }
  }
  return null;
}

export function resolveFromRecord(record, query) {
  const searched = (record?.documents || []).map((doc) => doc.name);
  const { terms, matches } = searchRecord(record, query, 8);

  if (!record || (record.segments || []).length === 0) {
    return { terms, matches: [], quotes: [], searched, missing: terms, outcome: 'NOT IN THE RECORD', conflict: null };
  }

  const best = matches[0]?.score || 0;
  const conflict = best >= 0.5 ? detectConflict(matches) : null;
  const quotes = matches.map((match) => ({
    document_name: match.document_name,
    role: match.role,
    ref: match.ref,
    quote: match.quote,
    verified: match.verified,
  }));
  const missing = terms.filter((term) => !matches.some((match) => match.hits.includes(term)));

  let outcome = 'NOT IN THE RECORD';
  if (conflict) outcome = 'CONFLICT IN THE RECORD';
  else if (best >= 0.7) outcome = 'ANSWERED FROM RECORD';
  else if (best >= 0.35) outcome = 'PARTLY ANSWERED';

  return { terms, matches, quotes, searched, missing, outcome, conflict };
}

export function questionStatus(resolution) {
  if (resolution.outcome === 'ANSWERED FROM RECORD') return 'Answered from the record - confirm';
  if (resolution.outcome === 'PARTLY ANSWERED') return 'Partly answered from the record';
  if (resolution.outcome === 'CONFLICT IN THE RECORD') return 'Conflict in the record';
  return 'Open';
}

export function formatRecordAnswer(resolution) {
  const lines = [`${RECORD_SENTINEL} ${resolution.outcome}`];
  (resolution.quotes || []).forEach((quote) => {
    lines.push(
      `${ROLE_LABELS[quote.role] || quote.role} · ${quote.document_name} · ${quote.ref}${
        quote.verified ? '' : ' (quote not verified)'
      } — “${quote.quote}”`
    );
  });
  if (resolution.conflict) {
    lines.push(
      `Conflict: ${ROLE_LABELS[resolution.conflict.roles[0]]} refers to ${resolution.conflict.left.join(', ')} and ${
        ROLE_LABELS[resolution.conflict.roles[1]]
      } to ${resolution.conflict.right.join(', ')}.`
    );
  }
  if ((resolution.missing || []).length) lines.push(`Not found in the record: ${resolution.missing.join(', ')}`);
  if ((resolution.searched || []).length) lines.push(`Searched: ${resolution.searched.join('; ')}`);
  return lines.join('\n');
}

function lawTimeline(record) {
  const groups = new Map();
  (record?.items || [])
    .filter((item) => LAW_KINDS.includes(item.kind))
    .forEach((item) => {
      const key = normalise(item.label);
      if (!groups.has(key)) groups.set(key, { label: item.label, kind: item.kind, statements: [] });
      groups.get(key).statements.push({
        document_name: item.document_name,
        role: item.role,
        ref: item.ref,
        quote: item.quote,
        text: item.segment_text || '',
        dates: datesIn(item.segment_text || ''),
      });
    });

  return [...groups.values()].map((entry) => {
    const dates = [...new Set(entry.statements.flatMap((statement) => statement.dates))];
    const inForce = entry.statements
      .filter((statement) => IN_FORCE.test(`${statement.text} ${statement.quote}`))
      .map((statement) => ({
        document_name: statement.document_name,
        role: statement.role,
        ref: statement.ref,
        quote: statement.quote,
      }));

    const flags = [];
    for (let i = 0; i < entry.statements.length; i += 1) {
      for (let j = i + 1; j < entry.statements.length; j += 1) {
        const left = entry.statements[i];
        const right = entry.statements[j];
        if (left.role === right.role || left.role === 'Unknown' || right.role === 'Unknown') continue;
        if (left.dates.length === 0 || right.dates.length === 0) continue;
        if (left.dates.some((date) => right.dates.includes(date))) continue;
        flags.push(
          `${ROLE_LABELS[left.role]} refers to ${left.dates.join(', ')} (${left.document_name}, ${left.ref}) while ${
            ROLE_LABELS[right.role]
          } refers to ${right.dates.join(', ')} (${right.document_name}, ${right.ref}) — compare both against the official commencement date.`
        );
      }
    }

    return {
      label: entry.label,
      kind: entry.kind,
      dates,
      in_force: inForce,
      timeline: entry.statements.map((statement) => ({
        document_name: statement.document_name,
        role: statement.role,
        ref: statement.ref,
        quote: statement.quote,
        dates: statement.dates,
      })),
      flags: [...new Set(flags)],
    };
  });
}

function courtFindings(record) {
  return (record?.segments || [])
    .filter((segment) => segment.role === 'Court' && RULING.test(segment.text))
    .slice(0, 60)
    .map((segment) => ({
      document_name: segment.document_name,
      ref: segment.ref,
      quote: clip(segment.text, 360),
    }));
}

function alreadyArgued(record, ourPoints = []) {
  return (ourPoints || []).map((point) => {
    const { matches } = searchRecord(record, point.text || '', 4);
    return {
      point: point.text || '',
      raised: matches.map((match) => ({
        document_name: match.document_name,
        role: match.role,
        ref: match.ref,
        quote: match.quote,
      })),
      addressed: matches
        .filter((match) => match.role === 'Court' || match.role === 'Other party')
        .map((match) => ({
          document_name: match.document_name,
          role: match.role,
          ref: match.ref,
          quote: match.quote,
        })),
    };
  });
}

function exhibitTexts(record) {
  const seen = new Set();
  const rows = [];
  (record?.items || [])
    .filter((item) => LAW_KINDS.includes(item.kind))
    .forEach((item) => {
      const key = `${normalise(item.label)}:${item.document_name}:${item.ref}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        reference: item.label,
        text: item.quote,
        document_name: item.document_name,
        paragraph_ref: item.ref,
        kind: item.kind,
        note: 'From the record - compare with official source',
      });
    });
  return rows;
}

export function buildSweeps(record, ourPoints = []) {
  return {
    dates_and_law: lawTimeline(record),
    court_found: courtFindings(record),
    already_argued: alreadyArgued(record, ourPoints),
    exhibits: exhibitTexts(record),
  };
}

function lookupFor(item, { ourPoints = [], clauses = [], misstatements = [] }) {
  if (item.id === 'facts_supported' || item.id === 'user_statements') {
    return ourPoints.map((point) => point.text || '').join(' ');
  }
  if (item.id === 'clauses') {
    return clauses.map((clause) => `${clause.reference || ''} ${clause.text || ''}`).join(' ');
  }
  if (item.id === 'misstatements') {
    return misstatements.map((entry) => `${entry.statement || ''} ${entry.correct_position || ''}`).join(' ');
  }
  return item.label || '';
}

export function buildRisks({ checklist = [], record, ourPoints = [], clauses = [], misstatements = [] } = {}) {
  return (checklist || []).map((item) => {
    const lookup = lookupFor(item, { ourPoints, clauses, misstatements });
    const { matches } = searchRecord(record, lookup, 3);
    const quotes = matches.map((match) => ({
      document_name: match.document_name,
      role: match.role,
      ref: match.ref,
      quote: match.quote,
      verified: match.verified,
    }));
    const conflict = matches.length > 1 ? detectConflict(matches) : null;

    let remaining = 'Unchanged';
    if (item.result === 'Yes') remaining = 'Closed';
    else if (conflict) remaining = 'New';
    else if (quotes.length > 0) remaining = 'Reduced';

    let whatWouldClose = item.fix || '';
    if (conflict) {
      whatWouldClose = `Say which version is right: ${ROLE_LABELS[conflict.roles[0]]} gives ${conflict.left.join(
        ', '
      )} and ${ROLE_LABELS[conflict.roles[1]]} gives ${conflict.right.join(', ')}.`;
    } else if (quotes.length > 0 && item.result !== 'Yes') {
      whatWouldClose = `Use the record reference: ${quotes[0].document_name}, ${quotes[0].ref}.`;
    }

    const unsupported = item.result === 'Yes' && quotes.length === 0 && DOC_SUPPORTED.has(item.id);

    return {
      id: item.id,
      label: item.label,
      priority: item.priority,
      result: item.result,
      original: `${item.label}: ${item.result}`,
      record_says: quotes,
      remaining,
      what_would_close: whatWouldClose,
      support: quotes.length > 0 ? 'record' : unsupported ? 'user' : 'none',
      conflict,
      note: unsupported ? 'Your position - not supported by the record' : '',
    };
  });
}

export function exhibitClause(row) {
  return {
    reference: row.reference,
    text: row.text,
    document_name: row.document_name,
    paragraph_ref: row.paragraph_ref || '',
    checked: false,
    source: row.note,
  };
}