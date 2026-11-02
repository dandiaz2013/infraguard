// Same URL rule as the citation parser: a Find Case Law link only where the neutral
// citation maps to one exactly. Deterministic, no AI.

const DIVISION_CODES = {
  ch: 'ch',
  comm: 'comm',
  tcc: 'tcc',
  admin: 'admin',
  kb: 'kb',
  qb: 'qb',
  ipec: 'ipec',
  fam: 'fam',
  pat: 'pat',
  admlty: 'admlty',
  costs: 'costs',
};

export function buildCaseLink(citation) {
  if (!citation) return '';
  const text = String(citation).replace(/\s+/g, ' ').trim();
  const match = text.match(/^\[(\d{4})\]\s+(UKSC|UKPC|EWCA\s+Civ|EWCA\s+Crim|EWHC)\s+(\d+)(?:\s*\(([A-Za-z]+)\))?$/i);
  if (!match) return '';

  const year = match[1];
  const code = match[2].replace(/\s+/g, ' ').toUpperCase();
  const number = match[3];
  const division = (match[4] || '').toLowerCase();
  const base = 'https://caselaw.nationalarchives.gov.uk';

  if (code === 'UKSC') return `${base}/uksc/${year}/${number}`;
  if (code === 'UKPC') return `${base}/ukpc/${year}/${number}`;
  if (code === 'EWCA CIV') return `${base}/ewca/civ/${year}/${number}`;
  if (code === 'EWCA CRIM') return `${base}/ewca/crim/${year}/${number}`;
  if (code === 'EWHC') {
    const path = DIVISION_CODES[division] || '';
    if (!path) return '';
    return `${base}/ewhc/${path}/${year}/${number}`;
  }
  return '';
}