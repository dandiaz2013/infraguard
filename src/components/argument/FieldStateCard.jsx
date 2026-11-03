import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CheckCircle2, PenLine, CircleDashed, Trash2, Plus } from 'lucide-react';

const STATE = {
  documents: {
    className: 'bg-green-50 text-green-900 border-green-300',
    Icon: CheckCircle2,
  },
  yours: {
    className: 'bg-amber-50 text-amber-900 border-amber-300',
    Icon: PenLine,
  },
  missing: {
    className: 'bg-slate-50 text-slate-700 border-slate-300',
    Icon: CircleDashed,
  },
};

export default function FieldStateCard({ field, onSave, onRemove, onOpenRecord }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(field.user_text || '');
  const [source, setSource] = useState(field.source_document || '');
  const [kind, setKind] = useState(field.user_kind || 'fact');
  const style = STATE[field.state] || STATE.missing;
  const Icon = style.Icon;

  const save = () => {
    if (!text.trim()) return;
    onSave(field, { text: text.trim(), source_document: source.trim(), kind });
    setOpen(false);
  };

  return (
    <div className="rounded border border-slate-200 p-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-800 min-w-0">{field.label}</p>
        <Badge variant="outline" className={`flex items-center gap-1 text-[10px] ${style.className}`}>
          <Icon className="h-3 w-3" />
          {field.stateLabel}
        </Badge>
      </div>

      {(field.group === 'facts' || field.group === 'chronology') && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">This note is</span>
          {[
            ['fact', 'A fact'],
            ['position', 'Our position'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded border px-2 py-0.5 text-[10px] ${
                kind === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {field.state === 'documents' && (
        <>
          <p className="mt-1 text-xs text-slate-700">“{field.quote}”</p>
          <button
            type="button"
            onClick={() => onOpenRecord?.(field.document_name, field.paragraph_ref)}
            className="text-[11px] text-blue-700 underline underline-offset-2"
          >
            {field.document_name}
            {field.paragraph_ref ? `, ${field.paragraph_ref}` : ''}
          </button>
        </>
      )}

      {field.state === 'yours' && (
        <>
          <p className="mt-1 text-xs text-slate-700">{field.user_text}</p>
          <p className="text-[11px] text-amber-800">
            Used in drafting as a statement by you until a source is added.
          </p>
          <button
            type="button"
            onClick={() => onRemove(field)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        </>
      )}

      {field.state === 'missing' && !open && (
        <div className="mt-1">
          <p className="text-xs text-slate-500">{field.prompt || 'Nothing in the record answers this.'}</p>
          <Button size="sm" variant="outline" className="mt-1" onClick={() => setOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Write it
          </Button>
        </div>
      )}

      {(open || (field.state === 'yours' && open)) && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            className="text-xs"
            placeholder="In your own words. This is used as a statement by you."
          />
          <Input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="text-xs"
            placeholder="Optional: document the source is in"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!text.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {field.state === 'yours' && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 underline underline-offset-2"
        >
          <PenLine className="h-3 w-3" />
          Edit
        </button>
      )}
    </div>
  );
}