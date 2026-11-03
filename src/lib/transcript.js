// Transcripts are cited by the numbers printed in the margin, not by position in
// the text. Deterministic: reads the printed page and line numbers as they appear.

const PAGE_MARK = /^\s*(?:page\s*|p\.?\s*)?(\d{1,3})(?:\s*(?:of|\/)\s*\d{1,3})?\s*$/i;
const LINE_MARK = /^\s*(\d{1,3})[\s.:|\]]+(?=\S)/;

export function parseTranscript(text = '') {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const pages = [];
  let page = null;
  let current = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const lineHit = trimmed.match(LINE_MARK);
    const expected = current ? current.n + 1 : null;
    const pageHit = trimmed.match(PAGE_MARK);
    // A bare number is a page marker unless it is the next printed line number.
    const isPageMarker = pageHit && (current === null || Number(pageHit[1]) !== expected);

    if (isPageMarker) {
      page = { page: Number(pageHit[1]), lines: [] };
      pages.push(page);
      current = null;
      continue;
    }

    if (!page) continue;

    if (lineHit) {
      current = { n: Number(lineHit[1]), text: trimmed.slice(lineHit[0].length).trim() };
      page.lines.push(current);
      continue;
    }

    if (pageHit && expected !== null) {
      current = { n: Number(pageHit[1]), text: '' };
      page.lines.push(current);
      continue;
    }

    if (current) current.text = `${current.text} ${trimmed}`.replace(/\s+/g, ' ').trim();
  }

  return { pages: pages.filter((entry) => entry.lines.length > 0) };
}

export function hasPrintedNumbers(parsed = {}) {
  return (parsed.pages || []).some((page) => page.lines.some((line) => line.n !== null));
}

// "p.16, ll.9-12" / "page 16 lines 9 to 12" -> the exact printed lines.
export function resolveLineRef(source, ref = '') {
  const parsed = typeof source === 'string' ? parseTranscript(source) : source || { pages: [] };
  const match = String(ref || '').match(
    /\bp\.?\s*(\d{1,3})\b[^\n]{0,14}?(?:ll?\.?|lines?)\s*(\d{1,3})\s*(?:[-–—]|to)\s*(\d{1,3})/i
  ) || String(ref || '').match(/\bp\.?\s*(\d{1,3})\b[^\n]{0,14}?(?:ll?\.?|lines?)\s*(\d{1,3})/i);

  if (!match) {
    return { found: false, text: '', reason: 'Not a page and line reference', missing: [] };
  }

  const pageNo = Number(match[1]);
  const from = Number(match[2]);
  const to = Number(match[3] || match[2]);
  const page = (parsed.pages || []).find((entry) => entry.page === pageNo);

  if (!page) {
    return { found: false, page: pageNo, from, to, text: '', reason: `Page ${pageNo} is not in the transcript`, missing: [from] };
  }

  const wanted = page.lines.filter((line) => line.n !== null && line.n >= from && line.n <= to);
  if (wanted.length === 0) {
    return {
      found: false,
      page: pageNo,
      from,
      to,
      text: '',
      reason: `Lines ${from}-${to} are not printed on page ${pageNo}`,
      missing: [from],
    };
  }

  const missing = [];
  for (let n = from; n <= to; n += 1) if (!wanted.some((line) => line.n === n)) missing.push(n);

  return {
    found: missing.length === 0,
    page: pageNo,
    from,
    to,
    text: wanted.map((line) => line.text).filter(Boolean).join(' '),
    lines: wanted,
    missing,
    reason: missing.length
      ? `Lines ${missing.join(', ')} are not printed on page ${pageNo}`
      : `Printed lines ${from}-${to} on page ${pageNo}`,
  };
}

// Segments for the record index: one per run of printed lines, refs use the
// printed numbers so "p.16 lines 9-16" points at what the page shows.
export function transcriptSegments(text = '', perSegment = 8) {
  const parsed = parseTranscript(text);
  if (!hasPrintedNumbers(parsed)) return [];
  const segments = [];
  parsed.pages.forEach((page) => {
    const numbered = page.lines.filter((line) => line.n !== null);
    for (let start = 0; start < numbered.length; start += perSegment) {
      const slice = numbered.slice(start, start + perSegment);
      if (!slice.length) continue;
      segments.push({
        ref: `p.${page.page} lines ${slice[0].n}-${slice[slice.length - 1].n}`,
        text: slice.map((line) => line.text).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
      });
    }
  });
  return segments.filter((segment) => segment.text.length > 1);
}