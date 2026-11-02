// Deterministic authority naming. Acronyms are expanded to full names and duplicate
// records for the same authority are grouped. Never applied to quotations.
import { normalise } from '@/lib/authorityCheck';

export const ACRONYMS = {
  psr: 'Payment Services Regulations',
  cpr: 'Civil Procedure Rules',
  cca: 'Consumer Credit Act 1974',
  fsma: 'Financial Services and Markets Act 2000',
  hra: 'Human Rights Act 1998',
  eqa: 'Equality Act 2010',
  dpa: 'Data Protection Act 2018',
  sga: 'Sale of Goods Act 1979',
  eca: 'Employment Rights Act 1996',
  ucta: 'Consumer Rights Act 2015',
};

const ACRONYM_TOKEN = /\b(PSR|CPR|CCA|FSMA|HRA|EQA|DPA|SGA|ECA|UCTA)\b/g;
const PARTY_SPLIT = /\s+v\.?\s+/i;

export function expandAcronym(label) {
  return String(label || '')
    .replace(ACRONYM_TOKEN, (token) => ACRONYMS[token.toLowerCase()] || token)
    .replace(/\s+/g, ' ')
    .trim();
}

// "tibbles" and "Tibbles v SIG" are the same authority: key on the first party.
export function authorityKey(name) {
  const text = expandAcronym(name);
  const parts = text.split(PARTY_SPLIT);
  const base = parts.length > 1 ? parts[0] : text;
  const key = normalise(base)
    .replace(/\b(limited|ltd|plc|inc|sa|nv|llp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return key;
}

export function authorityLabel(name) {
  return expandAcronym(name);
}

export function dedupeAuthorities(list = []) {
  const groups = new Map();
  (list || []).forEach((entry) => {
    const key = authorityKey(entry.name || entry.title || entry.label || '');
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  const items = [];
  const duplicates = [];
  groups.forEach((group, key) => {
    const sorted = group
      .slice()
      .sort((a, b) => String(b.name || b.title || '').length - String(a.name || a.title || '').length);
    const primary = sorted[0];
    const label = authorityLabel(primary.name || primary.title || '');
    items.push({ ...primary, key, name: label, merged_ids: group.map((entry) => entry.id).filter(Boolean) });
    if (group.length > 1) {
      duplicates.push({
        key,
        name: label,
        records: group.map((entry) => ({ id: entry.id, name: entry.name || entry.title })),
      });
    }
  });

  return { items, duplicates };
}

export function fullNameFor(label, list = []) {
  const key = authorityKey(label);
  const match = (list || []).find((entry) => entry.key === key || authorityKey(entry.name) === key);
  if (match) return match.name;
  const expanded = expandAcronym(label);
  return expanded;
}