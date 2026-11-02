import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/recordIndex';

const STYLES = {
  'ANSWERED FROM RECORD': {
    label: 'Answered from the record - confirm',
    cls: 'bg-green-100 text-green-900 border-green-300',
  },
  'PARTLY ANSWERED': {
    label: 'Partly answered from the record',
    cls: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  'NOT IN THE RECORD': {
    label: 'Not in the record',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  'CONFLICT IN THE RECORD': {
    label: 'Conflict in the record - which is right?',
    cls: 'bg-red-100 text-red-900 border-red-300',
  },
};

export default function RecordAnswer({ resolution, showSearched = true }) {
  if (!resolution) return null;
  const style = STYLES[resolution.outcome] || STYLES['NOT IN THE RECORD'];

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2 space-y-2">
      <Badge variant="outline" className={style.cls}>
        {style.label}
      </Badge>

      {(resolution.quotes || []).map((quote, index) => (
        <div key={`${quote.document_name}-${quote.ref}-${index}`} className="text-[11px] space-y-0.5">
          <p className="font-medium text-slate-600">
            Stated by {ROLE_LABELS[quote.role] || quote.role} — {quote.document_name}, {quote.ref}
          </p>
          <p className="text-slate-800">“{quote.quote}”</p>
          {!quote.verified && (
            <p className="text-red-700">Quote could not be verified against the extracted text.</p>
          )}
        </div>
      ))}

      {resolution.conflict && (
        <p className="text-[11px] text-red-800">
          {ROLE_LABELS[resolution.conflict.roles[0]]} refers to {resolution.conflict.left.join(', ')};{' '}
          {ROLE_LABELS[resolution.conflict.roles[1]]} refers to {resolution.conflict.right.join(', ')}.
        </p>
      )}

      {(resolution.missing || []).length > 0 && (
        <p className="text-[11px] text-slate-600">Not found in the record: {resolution.missing.join(', ')}</p>
      )}

      {showSearched && (resolution.searched || []).length > 0 && (
        <p className="text-[11px] text-slate-500">Searched: {resolution.searched.join('; ')}</p>
      )}

      {showSearched && (resolution.searched || []).length === 0 && (
        <p className="text-[11px] text-slate-500">No document has been uploaded to this matter yet.</p>
      )}
    </div>
  );
}