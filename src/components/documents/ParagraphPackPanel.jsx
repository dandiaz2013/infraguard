import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Pin, X } from 'lucide-react';
import { paragraphOptions } from '@/lib/documentPack';

export default function ParagraphPackPanel({ pack = {}, record = {}, pinned = [], onPin, onUnpin }) {
  const [documentName, setDocumentName] = useState('');
  const [ref, setRef] = useState('');
  const documents = record.documents || [];
  const options = documentName ? paragraphOptions(record, documentName) : [];
  const paragraphs = pack.paragraphs || [];

  const byDocument = paragraphs.reduce((acc, row) => {
    const key = row.document_name || 'Document';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const choose = () => {
    const option = options.find((entry) => entry.ref === ref);
    if (!option) return;
    onPin({ document_name: option.document_name, document_id: option.document_id, ref: option.ref, text: option.text });
    setRef('');
  };

  return (
    <Card className="shadow-md border-l-4 border-l-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-slate-700" />
          The paragraphs sent with the draft
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          {pack.count || 0} paragraph{(pack.count || 0) === 1 ? '' : 's'} in full, {(pack.chars || 0).toLocaleString()}{' '}
          characters. Chosen by the gateway issues and Our points, plus any paragraph you pin. Each block carries its
          document id and paragraph number, so the draft can cite it as {'{{DOC:id|para:n}}'}.
        </p>

        {documents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-[11px]">Pin a paragraph</Label>
              <Select
                value={documentName}
                onValueChange={(value) => {
                  setDocumentName(value);
                  setRef('');
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Document" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.name}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Paragraph</Label>
              <Select value={ref} onValueChange={setRef} disabled={!documentName}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Paragraph" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.ref} value={option.ref}>
                      {option.ref} — {option.text.slice(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={choose} disabled={!ref}>
              <Pin className="h-3.5 w-3.5 mr-1" />
              Pin
            </Button>
          </div>
        )}

        {pinned.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pinned.map((row) => (
              <Badge key={`${row.document_name}:${row.ref}`} variant="outline" className="gap-1 text-[10px]">
                {row.document_name}, {row.ref}
                <button type="button" onClick={() => onUnpin(row)} className="text-slate-500 hover:text-slate-900">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {Object.entries(byDocument).map(([name, rows]) => (
            <details key={name} className="rounded border border-slate-200 px-2 py-1">
              <summary className="cursor-pointer text-xs font-medium text-slate-800">
                {name} — {rows.length} paragraph{rows.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-1 space-y-1">
                {rows.map((row) => (
                  <li key={`${row.document_id}:${row.ref}`} className="text-[11px] text-slate-600">
                    <span className="font-medium text-slate-700">{row.ref}</span> · {row.why} — {row.text.slice(0, 110)}
                    {row.text.length > 110 ? '…' : ''}
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {paragraphs.length === 0 && (
            <p className="text-xs text-slate-500">
              Tick a case file document below. Nothing ticked means nothing can be quoted.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}