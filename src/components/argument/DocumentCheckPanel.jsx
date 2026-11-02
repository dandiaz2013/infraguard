import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { resolveDocumentRefs, checkDocumentQuotes, sourcePackRows } from '@/lib/docReferences';
import SourcePackTable from '@/components/argument/SourcePackTable';

const STATUS_STYLE = {
  found: 'bg-green-100 text-green-900 border-green-300',
  missing_document: 'bg-red-100 text-red-900 border-red-300',
  missing_paragraph: 'bg-red-100 text-red-900 border-red-300',
  ambiguous: 'bg-amber-100 text-amber-900 border-amber-300',
};

export default function DocumentCheckPanel({ text, documents = [], extracts = [] }) {
  const rows = useMemo(() => resolveDocumentRefs(text, documents), [text, documents]);
  const quotes = useMemo(() => checkDocumentQuotes(text, documents, extracts), [text, documents, extracts]);
  const pack = useMemo(() => sourcePackRows(rows), [rows]);

  if (!text) return null;

  const problems = rows.filter((row) => row.status !== 'found').length;
  const mismatched = quotes.filter((entry) => entry.status === 'mismatch');
  const documentQuotes = quotes.filter((entry) => entry.status !== 'authority');

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {problems === 0 && mismatched.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <TriangleAlert className="h-4 w-4 text-red-600" />
          )}
          B · Document reference check — against the uploaded documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className={`text-sm ${problems === 0 ? 'text-green-700' : 'text-red-700'}`}>
          {rows.length} document reference{rows.length === 1 ? '' : 's'} checked against{' '}
          {documents.length} uploaded document{documents.length === 1 ? '' : 's'}.{' '}
          {rows.length === 0
            ? 'The draft makes no structured document reference yet.'
            : problems === 0
              ? 'Every reference resolves to a paragraph in the document.'
              : `${problems} reference${problems === 1 ? '' : 's'} could not be resolved.`}
        </p>

        {rows.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 px-3">Reference</th>
                  <th className="py-2 px-3">Result</th>
                  <th className="py-2 px-3">Exact paragraph text</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.raw}-${index}`} className="border-t border-slate-100 align-top">
                    <td className="py-2 px-3 text-slate-800" title={row.detail || row.text}>
                      {row.label}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={STATUS_STYLE[row.status] || ''}>
                        {row.statusLabel}
                      </Badge>
                      {row.detail && <p className="text-[11px] text-slate-500 mt-1 max-w-xs">{row.detail}</p>}
                    </td>
                    <td className="py-2 px-3 text-slate-700 max-w-lg">
                      {row.text || <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {documentQuotes.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
              Quotations in the draft (character for character)
            </h4>
            <div className="space-y-1">
              {documentQuotes.map((entry, index) => (
                <div
                  key={index}
                  className={`rounded border px-3 py-2 text-xs ${
                    entry.status === 'match'
                      ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-red-300 bg-red-50 text-red-800'
                  }`}
                >
                  <p className="font-medium">“{entry.quote}”</p>
                  {entry.status === 'match' ? (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Matches {entry.document_name}, {entry.reference}
                    </p>
                  ) : (
                    <p className="text-[11px] mt-0.5">
                      Does not match the document text. Closest text
                      {entry.document_name ? ` — ${entry.document_name}, ${entry.reference}:` : ':'}{' '}
                      {entry.text || 'no comparable text in the uploaded documents'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <SourcePackTable rows={pack} title="Source pack" />
      </CardContent>
    </Card>
  );
}