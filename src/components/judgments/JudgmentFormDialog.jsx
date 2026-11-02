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

const EMPTY = { title: '', court: '', judgment_date: '', source_url: '', raw_text: '' };

export default function JudgmentFormDialog({ open, onOpenChange, onSave, isSaving }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      title: form.title.trim(),
      court: form.court.trim(),
      judgment_date: form.judgment_date || undefined,
      source_url: form.source_url.trim(),
      raw_text: form.raw_text,
      parse_status: 'unparsed',
      parse_log: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add judgment</DialogTitle>
          <DialogDescription>
            Paste the judgment text so the citation parser can read it. Keep a link to the primary source.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="court">Court</Label>
              <Input id="court" value={form.court} onChange={(e) => update('court', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="date">Judgment date</Label>
              <Input
                id="date"
                type="date"
                value={form.judgment_date}
                onChange={(e) => update('judgment_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="source">Source URL</Label>
            <Input
              id="source"
              placeholder="https://www.bailii.org/..."
              value={form.source_url}
              onChange={(e) => update('source_url', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="raw_text">Judgment text</Label>
            <Textarea
              id="raw_text"
              rows={12}
              placeholder="Paste the full judgment text here..."
              value={form.raw_text}
              onChange={(e) => update('raw_text', e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-500 mt-1">
              Paste the text itself. PDF and DOCX extraction is not part of the parser.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.title.trim()}>
              {isSaving ? 'Saving...' : 'Save judgment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}