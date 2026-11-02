import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ClipboardPaste } from 'lucide-react';

export default function ExtractPasteBox({ caseLaw = [], defaultCaseId = '', proposition = '', onSaved }) {
  const [caseId, setCaseId] = useState(defaultCaseId);
  const [paragraphRef, setParagraphRef] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (defaultCaseId) setCaseId(defaultCaseId);
  }, [defaultCaseId]);

  const save = async () => {
    if (!caseId || !paragraphRef.trim() || !text.trim()) return;
    setSaving(true);
    try {
      await base44.entities.AuthorityExtract.create({
        case_law_id: caseId,
        paragraph_ref: paragraphRef.trim(),
        extract_text: text.trim(),
        proposition: proposition || '',
        added_date: new Date().toISOString(),
      });
      setParagraphRef('');
      setText('');
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-900 flex items-center gap-2">
        <ClipboardPaste className="h-4 w-4" />
        Paste the paragraph from the official judgment, word for word
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-amber-900">Authority</Label>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue placeholder="Select authority..." />
            </SelectTrigger>
            <SelectContent>
              {caseLaw.map((record) => (
                <SelectItem key={record.id} value={record.id}>
                  {record.name} {record.neutral_citation || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-amber-900">Paragraph reference</Label>
          <Input
            value={paragraphRef}
            onChange={(event) => setParagraphRef(event.target.value)}
            placeholder="para 45"
            className="h-8 text-xs bg-white"
          />
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste the exact wording of the paragraph..."
        rows={3}
        className="text-xs bg-white"
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving || !caseId || !paragraphRef.trim() || !text.trim()}>
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Save extract
        </Button>
      </div>
    </div>
  );
}