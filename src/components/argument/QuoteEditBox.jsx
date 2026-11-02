import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

// Corrects the wording of a quotation in the draft.
export default function QuoteEditBox({ quote, onCancel, onSave }) {
  const [value, setValue] = useState(quote || '');

  return (
    <div className="rounded border border-slate-300 bg-slate-50 p-2 space-y-2">
      <p className="text-[11px] text-slate-700">
        Correct the wording. The draft is updated and the check is run again.
      </p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-input bg-background p-2 text-xs"
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => onSave(value.trim())}
          disabled={value.trim().length < 12 || value.trim() === String(quote || '').trim()}
        >
          Save the correction
        </Button>
      </div>
    </div>
  );
}