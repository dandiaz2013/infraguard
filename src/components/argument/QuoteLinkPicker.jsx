import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findParagraph } from '@/lib/docReferences';
import { normalise } from '@/lib/authorityCheck';

// Links a quotation to the case file document and paragraph it actually comes from.
export default function QuoteLinkPicker({ quote, documents = [], onCancel, onSave }) {
  const [docId, setDocId] = useState('');
  const [paragraph, setParagraph] = useState('');
  const [error, setError] = useState('');

  const doc = documents.find((entry) => String(entry.id) === String(docId));

  const save = () => {
    if (!doc) {
      setError('Choose the document this wording is in.');
      return;
    }
    const number = String(paragraph).match(/\d{1,3}/);
    if (!number) {
      setError('Give the paragraph number.');
      return;
    }
    const found = findParagraph(doc.text, Number(number[0]));
    if (found.status === 'missing') {
      setError(`Paragraph ${number[0]} is not in the extracted text of ${doc.name}.`);
      return;
    }
    if (!normalise(found.text).includes(normalise(quote))) {
      setError('That paragraph does not contain this wording. Check the number against the document.');
      return;
    }
    onSave({ document_name: doc.name, paragraph_ref: `para ${Number(number[0])}` });
  };

  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-2 space-y-2">
      <p className="text-[11px] text-blue-900">
        Pick the document and the paragraph that contains this wording. It will be checked in section B.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-blue-900">Document</Label>
          <Select value={docId} onValueChange={setDocId}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue placeholder="Select document..." />
            </SelectTrigger>
            <SelectContent>
              {documents.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-blue-900">Paragraph</Label>
          <Input
            value={paragraph}
            onChange={(event) => setParagraph(event.target.value)}
            placeholder="12"
            className="h-8 text-xs bg-white"
          />
        </div>
      </div>

      {error && <p className="text-[11px] text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 text-[11px]" onClick={save} disabled={!docId || !paragraph.trim()}>
          Link it
        </Button>
      </div>
    </div>
  );
}