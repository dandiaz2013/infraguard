import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function RegisterLawFields({ value = {}, onSave }) {
  const [form, setForm] = useState({
    provision_text: value.provision_text || '',
    commencement_date: value.commencement_date || '',
    revocation_note: value.revocation_note || '',
    source_link: value.source_link || '',
    compared_confirmed: Boolean(value.compared_confirmed),
  });

  const set = (key, next) => setForm((prev) => ({ ...prev, [key]: next }));

  return (
    <div className="space-y-2 border border-amber-300 bg-amber-50 rounded p-2">
      <p className="text-[11px] text-amber-900">
        Paste the provision as it appears in the official source. The system will not answer this from memory.
      </p>
      <div>
        <Label className="text-[11px]">Provision text</Label>
        <Textarea rows={3} className="text-xs" value={form.provision_text} onChange={(e) => set('provision_text', e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[11px]">Commencement date</Label>
          <Input className="text-xs" placeholder="e.g. 13 January 2018" value={form.commencement_date} onChange={(e) => set('commencement_date', e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Official source link</Label>
          <Input className="text-xs" placeholder="https://www.legislation.gov.uk/..." value={form.source_link} onChange={(e) => set('source_link', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-[11px]">Revocation, replacement or transitional provision</Label>
        <Textarea rows={2} className="text-xs" value={form.revocation_note} onChange={(e) => set('revocation_note', e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-[11px] text-amber-900">
        <Checkbox checked={form.compared_confirmed} onCheckedChange={(checked) => set('compared_confirmed', checked === true)} />
        I compared this with the official source
      </label>
      <Button size="sm" onClick={() => onSave(form)} disabled={!form.provision_text.trim()}>
        Save the official text
      </Button>
    </div>
  );
}