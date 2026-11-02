import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const EMPTY_FORM = {
  name: '',
  neutral_citation: '',
  court: '',
  year: '',
  report_reference: '',
  url: '',
  summary: '',
  principles_text: '',
  source_note: '',
  verified: false,
};

function toForm(record) {
  if (!record) return EMPTY_FORM;
  return {
    name: record.name || '',
    neutral_citation: record.neutral_citation || '',
    court: record.court || '',
    year: record.year ? String(record.year) : '',
    report_reference: record.report_reference || '',
    url: record.url || '',
    summary: record.summary || '',
    principles_text: (record.principles || []).join('\n'),
    source_note: record.source_note || '',
    verified: !!record.verified,
  };
}

export default function CaseLawFormDialog({ open, onOpenChange, initial, onSave, isSaving }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) setForm(toForm(initial));
  }, [open, initial]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const year = form.year.trim() === '' ? undefined : Number(form.year);
    onSave({
      name: form.name.trim(),
      neutral_citation: form.neutral_citation.trim(),
      court: form.court.trim(),
      year: Number.isFinite(year) ? year : undefined,
      report_reference: form.report_reference.trim(),
      url: form.url.trim(),
      summary: form.summary.trim(),
      principles: form.principles_text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      source_note: form.source_note.trim(),
      verified: form.verified,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit authority' : 'Add authority'}</DialogTitle>
          <DialogDescription>
            Record the authority exactly as it appears in the primary source.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Case name *</Label>
            <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="citation">Neutral citation</Label>
              <Input
                id="citation"
                placeholder="[2023] UKSC 12"
                value={form.neutral_citation}
                onChange={(e) => update('neutral_citation', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="court">Court</Label>
              <Input id="court" value={form.court} onChange={(e) => update('court', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={form.year}
                onChange={(e) => update('year', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="report">Report reference</Label>
              <Input
                id="report"
                value={form.report_reference}
                onChange={(e) => update('report_reference', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="url">Link to primary source</Label>
            <Input
              id="url"
              placeholder="https://www.bailii.org/..."
              value={form.url}
              onChange={(e) => update('url', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={3}
              value={form.summary}
              onChange={(e) => update('summary', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="principles">Principles (one per line)</Label>
            <Textarea
              id="principles"
              rows={4}
              value={form.principles_text}
              onChange={(e) => update('principles_text', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="source_note">Source note</Label>
            <Input
              id="source_note"
              placeholder="How and where this record was checked"
              value={form.source_note}
              onChange={(e) => update('source_note', e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              id="verified"
              checked={form.verified}
              onCheckedChange={(checked) => update('verified', checked === true)}
            />
            <div>
              <Label htmlFor="verified" className="cursor-pointer">
                I have verified this against a primary source
              </Label>
              <p className="text-xs text-slate-500 mt-1">
                Only tick this once you have checked the citation and principle yourself.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.name.trim()}>
              {isSaving ? 'Saving...' : 'Save authority'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}