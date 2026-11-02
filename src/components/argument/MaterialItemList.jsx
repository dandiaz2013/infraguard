import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X } from 'lucide-react';

export default function MaterialItemList({ title, hint, fields, items, onAdd, onRemove, onToggle, toggleLabel, inputId }) {
  const [draft, setDraft] = useState({});
  const primary = fields[0].key;
  const canAdd = Boolean((draft[primary] || '').trim());

  const add = () => {
    if (!canAdd) return;
    onAdd({ ...draft });
    setDraft({});
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="text-xs text-slate-500">{items.length}</span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{hint}</p>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="rounded border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-800 flex-1">{item[primary]}</p>
              <button onClick={() => onRemove(index)} className="text-slate-400 hover:text-red-600" aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {fields.slice(1).map((field) => (item[field.key] ? <span key={field.key}>{item[field.key]}</span> : null))}
            </div>
            {toggleLabel && (
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                <Checkbox checked={Boolean(item.checked)} onCheckedChange={() => onToggle(index)} />
                {toggleLabel}
              </label>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400">Nothing added yet.</p>}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <Input
            key={field.key}
            id={field.key === primary ? inputId : undefined}
            value={draft[field.key] || ''}
            placeholder={field.placeholder}
            onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
            className="text-xs"
          />
        ))}
      </div>

      <Button size="sm" variant="outline" className="mt-2" onClick={add} disabled={!canAdd}>
        <Plus className="h-3 w-3 mr-1" />
        Add
      </Button>
    </div>
  );
}