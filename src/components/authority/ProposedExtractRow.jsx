import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { CHECKED_STATUS, PROPOSED_STATUS, isExtractChecked } from '@/lib/extractStatus';

const HELP_STYLE = {
  'Helps us': 'bg-green-100 text-green-900 border-green-300',
  'Hurts us': 'bg-red-100 text-red-900 border-red-300',
  Both: 'bg-amber-100 text-amber-900 border-amber-300',
  'Not classified': 'bg-slate-100 text-slate-700 border-slate-300',
};

export default function ProposedExtractRow({ extract, caseRecord, onSaved }) {
  const [note, setNote] = useState(extract.checked_notes || '');
  const [saving, setSaving] = useState(false);
  const checked = isExtractChecked(extract, caseRecord);

  const toggle = async (value) => {
    setSaving(true);
    try {
      await base44.entities.AuthorityExtract.update(extract.id, {
        status: value ? CHECKED_STATUS : PROPOSED_STATUS,
        checked_date: value ? new Date().toISOString() : '',
        checked_notes: note.trim(),
      });
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${checked ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-700">{extract.paragraph_ref || 'no paragraph'}</span>
        <Badge variant="outline" className={`text-[11px] ${HELP_STYLE[extract.helps_hurts] || HELP_STYLE['Not classified']}`}>
          {extract.helps_hurts || 'Not classified'}
        </Badge>
        {checked ? (
          <Badge variant="outline" className="text-[11px] bg-green-100 text-green-900 border-green-300">
            Checked against the official text
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[11px] bg-amber-100 text-amber-900 border-amber-300">
            Proposed - compare with the official text
          </Badge>
        )}
        {saving && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
      </div>

      <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{extract.extract_text}</p>

      {extract.proposition && (
        <p className="mt-2 text-xs text-slate-700">
          <span className="font-semibold">Proposition:</span> {extract.proposition}
        </p>
      )}

      {extract.supports?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {extract.supports.map((entry, index) => (
            <li key={index} className="text-[11px] text-slate-600">
              {entry.kind === 'misstatement' ? 'Undermines the misstatement' : 'Supports our point'}: {entry.text}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-xs text-slate-800">
          <Checkbox checked={checked} onCheckedChange={(value) => toggle(value === true)} disabled={saving} />
          I compared this with the official text
        </label>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note recorded when checking (optional)"
          className="h-8 text-xs sm:max-w-xs"
        />
        {checked && extract.checked_date && (
          <span className="text-[11px] text-slate-500">Checked {String(extract.checked_date).slice(0, 10)}</span>
        )}
      </div>
    </div>
  );
}