import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExtractEditor from '@/components/caselaw/ExtractEditor';
import { buildCaseLink } from '@/lib/citationUrl';

const EMPTY = {
  name: '',
  neutral_citation: '',
  court: '',
  year: '',
  url: '',
  is_main: true,
  matter_id: '',
};

export default function MainAuthorityDialog({ open, onOpenChange, initial, matters = [], onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [rows, setRows] = useState([]);
  const [sourceFileUrl, setSourceFileUrl] = useState('');
  const [urlEditedByUser, setUrlEditedByUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setRows([]);
    setSourceFileUrl('');
    if (initial) {
      setForm({
        name: initial.name || '',
        neutral_citation: initial.neutral_citation || '',
        court: initial.court || '',
        year: initial.year ? String(initial.year) : '',
        url: initial.official_url || initial.url || '',
        is_main: initial.is_main !== false,
        matter_id: '',
      });
      setUrlEditedByUser(true);
    } else {
      setForm(EMPTY);
      setUrlEditedByUser(false);
    }
  }, [open, initial]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateCitation = (value) => {
    setForm((prev) => ({
      ...prev,
      neutral_citation: value,
      url: urlEditedByUser ? prev.url : buildCaseLink(value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const cleanRows = rows.filter((row) => row.text.trim());
    if (cleanRows.some((row) => !row.paragraph_ref.trim())) {
      setError('Give every extract a paragraph number.');
      return;
    }
    if (cleanRows.some((row) => !row.proposition.trim())) {
      setError('Type the proposition each extract supports.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const year = form.year.trim() === '' ? undefined : Number(form.year);
      const link = form.url.trim();
      const payload = {
        name: form.name.trim(),
        neutral_citation: form.neutral_citation.trim(),
        court: form.court.trim(),
        year: Number.isFinite(year) ? year : undefined,
        official_url: link,
        url: link,
        is_main: form.is_main,
      };

      const record = initial
        ? await base44.entities.CaseLaw.update(initial.id, payload)
        : await base44.entities.CaseLaw.create(payload);

      if (cleanRows.length > 0) {
        await base44.entities.AuthorityExtract.bulkCreate(
          cleanRows.map((row) => ({
            case_law_id: record.id,
            paragraph_ref: row.paragraph_ref.trim(),
            extract_text: row.text.trim(),
            proposition: row.proposition.trim(),
            source_file_url: sourceFileUrl || '',
            matter_ids: form.matter_id ? [form.matter_id] : [],
            added_date: new Date().toISOString(),
          }))
        );
      }

      onSaved();
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError.message || 'Could not save that authority.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Add extracts' : 'Add main authority'}</DialogTitle>
          <DialogDescription>
            Paste the paragraphs exactly as they appear in the official judgment. Nothing here is rewritten.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ma-name">Case name *</Label>
            <Input
              id="ma-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ma-citation">Neutral citation</Label>
              <Input
                id="ma-citation"
                placeholder="[2023] UKSC 12"
                value={form.neutral_citation}
                onChange={(event) => updateCitation(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ma-court">Court</Label>
              <Input
                id="ma-court"
                value={form.court}
                onChange={(event) => update('court', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ma-year">Year</Label>
              <Input
                id="ma-year"
                type="number"
                value={form.year}
                onChange={(event) => update('year', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ma-matter">Link extracts to a matter</Label>
              <Select
                value={form.matter_id || 'none'}
                onValueChange={(value) => update('matter_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="ma-matter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No matter yet</SelectItem>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.matter_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="ma-link">Official link</Label>
            <Input
              id="ma-link"
              placeholder="https://caselaw.nationalarchives.gov.uk/..."
              value={form.url}
              onChange={(event) => {
                setUrlEditedByUser(true);
                update('url', event.target.value);
              }}
            />
            <p className="text-xs text-slate-500 mt-1">
              Built from the neutral citation where the citation maps to a Find Case Law page. Edit it if the official page is elsewhere.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              id="ma-main"
              checked={form.is_main}
              onCheckedChange={(checked) => update('is_main', checked === true)}
            />
            <div>
              <Label htmlFor="ma-main" className="cursor-pointer">Mark as main authority</Label>
              <p className="text-xs text-slate-500 mt-1">
                Main authorities are listed first in every argument and shown on the Matter page.
              </p>
            </div>
          </div>

          <ExtractEditor
            rows={rows}
            onChange={setRows}
            sourceFileUrl={sourceFileUrl}
            onSourceChange={setSourceFileUrl}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

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