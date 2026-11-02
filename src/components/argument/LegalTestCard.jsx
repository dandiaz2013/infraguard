import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Loader2, Plus, Trash2, Undo2 } from 'lucide-react';

export default function LegalTestCard({ test, extracts = [], caseLaw = [], onRefresh }) {
  const [name, setName] = useState(test.name || '');
  const [notes, setNotes] = useState(test.notes || '');
  const [elements, setElements] = useState(test.elements || []);
  const [saving, setSaving] = useState(false);

  const confirmed = test.status === 'Confirmed by user';
  const sourceCase = caseLaw.find((record) => record.id === test.source_case_law_id);

  const update = (index, patch) => {
    setElements((prev) => prev.map((element, position) => (position === index ? { ...element, ...patch } : element)));
  };

  const addElement = () => {
    setElements((prev) => [
      ...prev,
      { number: prev.length + 1, text: '', user_confirmed: false, source_extract_id: '' },
    ]);
  };

  const save = async (status) => {
    setSaving(true);
    try {
      const clean = elements
        .filter((element) => (element.text || '').trim())
        .map((element, index) => ({
          number: index + 1,
          text: element.text.trim(),
          source_extract_id: element.source_extract_id || '',
          source_document_name: element.source_document_name || '',
          source_paragraph_ref: element.source_paragraph_ref || '',
          source_quote: element.source_quote || '',
          user_confirmed: status === 'Confirmed by user' ? true : Boolean(element.user_confirmed),
        }));

      await base44.entities.LegalTest.update(test.id, {
        name: name.trim() || test.name,
        notes,
        elements: clean,
        status: status || test.status,
        source_extract_ids: clean.map((element) => element.source_extract_id).filter(Boolean),
      });
      if (onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await base44.entities.LegalTest.delete(test.id);
    if (onRefresh) onRefresh();
  };

  const sourceLabel = (element) => {
    if (element.source_extract_id) {
      const extract = extracts.find((entry) => entry.id === element.source_extract_id);
      return `Stored extract: ${extract ? extract.paragraph_ref || 'paragraph' : 'linked paragraph'}`;
    }
    if (element.source_document_name) {
      return `Document: ${element.source_document_name}${element.source_paragraph_ref ? `, ${element.source_paragraph_ref}` : ''}`;
    }
    return 'No source recorded';
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={confirmed ? 'bg-green-100 text-green-900 border-green-300' : 'bg-amber-100 text-amber-900 border-amber-300'}>
          {confirmed ? 'Confirmed by user' : 'Proposed'}
        </Badge>
        {sourceCase && (
          <span className="text-xs text-slate-500">
            {sourceCase.name} {sourceCase.neutral_citation || ''}
          </span>
        )}
        {test.source_extract_ids?.length > 0 && (
          <span className="text-xs text-slate-500">
            {test.source_extract_ids.length} stored extract{test.source_extract_ids.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <Input value={name} onChange={(event) => setName(event.target.value)} className="text-sm font-medium" />

      <div className="space-y-2">
        {elements.map((element, index) => (
          <div key={index} className="border border-slate-200 rounded p-2 space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-slate-500 mt-2">Element {index + 1}</span>
              <Textarea
                value={element.text || ''}
                onChange={(event) => update(index, { text: event.target.value })}
                rows={2}
                className="text-xs flex-1"
              />
              <div className="flex flex-col items-center gap-1">
                <Checkbox
                  checked={Boolean(element.user_confirmed)}
                  onCheckedChange={(value) => update(index, { user_confirmed: Boolean(value) })}
                  title="Element confirmed"
                />
                <button
                  type="button"
                  onClick={() => setElements((prev) => prev.filter((_, position) => position !== index))}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">{sourceLabel(element)}</p>
            {element.source_quote && (
              <p className="text-[11px] text-slate-600 border-l-2 border-slate-200 pl-2">{element.source_quote}</p>
            )}
          </div>
        ))}
      </div>

      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes on this test (optional)"
        rows={2}
        className="text-xs"
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={addElement}>
          <Plus className="h-3 w-3 mr-1" />
          Add element
        </Button>
        <Button size="sm" variant="outline" onClick={() => save()} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Save changes
        </Button>
        {confirmed ? (
          <Button size="sm" variant="outline" onClick={() => save('Proposed')} disabled={saving}>
            <Undo2 className="h-3 w-3 mr-1" />
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={() => save('Confirmed by user')} disabled={saving || elements.length === 0}>
            <Check className="h-3 w-3 mr-1" />
            Confirm test
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-red-600" onClick={remove}>
          Delete
        </Button>
      </div>
    </div>
  );
}