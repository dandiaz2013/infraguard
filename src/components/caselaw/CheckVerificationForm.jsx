import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck } from 'lucide-react';
import { CHECKED, NOT_CHECKED, isChecked } from '@/lib/authorityCheck';

export default function CheckVerificationForm({ record, onSaved }) {
  const [ticked, setTicked] = useState(isChecked(record));
  const [notes, setNotes] = useState(record.checked_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await base44.entities.CaseLaw.update(record.id, {
        check_status: ticked ? CHECKED : NOT_CHECKED,
        checked_date: ticked ? new Date().toISOString() : '',
        checked_notes: notes.trim(),
      });
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          Check against the official judgment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            id="check-extracts"
            checked={ticked}
            onCheckedChange={(checked) => setTicked(checked === true)}
          />
          <div>
            <Label htmlFor="check-extracts" className="cursor-pointer">
              I have compared these extracts with the official judgment
            </Label>
            <p className="text-xs text-slate-500 mt-1">
              Paragraph numbers and wording only. This tick is set by you, never by the app.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="check-notes" className="text-xs">Note</Label>
          <Textarea
            id="check-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What you compared, and any correction made"
            className="mt-1 text-sm"
          />
        </div>

        {record.checked_date && (
          <p className="text-xs text-slate-500">
            Last checked {new Date(record.checked_date).toLocaleString()}
          </p>
        )}

        <Button size="sm" onClick={save} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save check'}
        </Button>
      </CardContent>
    </Card>
  );
}