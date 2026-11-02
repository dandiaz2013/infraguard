import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FolderOpen } from 'lucide-react';
import { CASE_FILE_CATEGORIES, defaultSourceSelection } from '@/lib/caseFile';

export default function SourceMaterialPanel({ documents = [], ticked = {}, onToggle }) {
  if (documents.length === 0) return null;

  const defaults = defaultSourceSelection(documents);
  const reasonFor = (id) => defaults.find((row) => row.id === id)?.reason || 'Chosen by you';
  const tickedRows = documents.filter((document) => ticked[document.id]);

  return (
    <Card className="shadow-md border-l-4 border-l-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-5 w-5 text-slate-700" />
          Source material
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Tick the case file documents this draft may use. It quotes only from the ticked documents, with exact
          text and paragraph references, checked in code after drafting.
        </p>

        <div className="space-y-3">
          {CASE_FILE_CATEGORIES.map((category) => {
            const rows = documents.filter((document) => (document.category || 'Other') === category);
            if (rows.length === 0) return null;
            return (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</p>
                <div className="mt-1 space-y-1">
                  {rows.map((document) => (
                    <label
                      key={document.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={Boolean(ticked[document.id])}
                        onCheckedChange={() => onToggle(document.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-slate-800 truncate">{document.file_name}</span>
                        <span className="block text-[11px] text-slate-500">
                          {document.party || 'Party not recorded'} · {document.document_date || 'No date'} ·{' '}
                          {document.record_status || 'Filed or served'}
                          {ticked[document.id] ? ` · ${reasonFor(document.id)}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold text-slate-700">
            {tickedRows.length} of {documents.length} case file document
            {documents.length === 1 ? '' : 's'} ticked
          </p>
          {tickedRows.length === 0 ? (
            <p className="text-xs text-slate-500 mt-1">
              Nothing ticked. The draft will not quote from a document.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {tickedRows.map((document) => (
                <li key={document.id} className="text-xs text-slate-600">
                  {document.file_name} - {reasonFor(document.id)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}