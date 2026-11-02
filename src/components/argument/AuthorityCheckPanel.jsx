import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  checkQuotations,
  checkParagraphRefs,
  isChecked,
  NO_EXTRACT_MARKER,
  NOT_CHECKED_MARKER,
} from '@/lib/authorityCheck';
import { stripDocumentRefs } from '@/lib/docReferences';

export default function AuthorityCheckPanel({ text, extracts = [], mainAuthorities = [] }) {
  const cleaned = useMemo(() => stripDocumentRefs(text), [text]);
  const quotations = useMemo(() => checkQuotations(cleaned, extracts), [cleaned, extracts]);
  const references = useMemo(() => checkParagraphRefs(cleaned, extracts), [cleaned, extracts]);

  if (!text) return null;

  const quoteFails = quotations.filter((entry) => !entry.matched);
  const refFails = references.filter((entry) => !entry.matched);

  const notices = mainAuthorities.map((record) => ({
    id: record.id,
    name: record.name,
    citation: record.neutral_citation || '',
    hasExtract: extracts.some((extract) => extract.case_law_id === record.id),
    checked: isChecked(record),
  }));

  const problems = quoteFails.length + refFails.length;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {problems === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <TriangleAlert className="h-4 w-4 text-red-600" />
          )}
          A · Authority check — case law quotations and paragraph references
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={`text-sm ${problems === 0 ? 'text-green-700' : 'text-red-700'}`}>
          {quotations.length} quotation{quotations.length === 1 ? '' : 's'} and {references.length} paragraph
          reference{references.length === 1 ? '' : 's'} checked against the stored authority extracts.{' '}
          {problems === 0
            ? 'Every one matches a stored extract.'
            : `${problems} do not match a stored extract.`}
        </p>

        {quotations.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Quotations</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Quotation in draft</th>
                  <th className="py-2">Stored extract</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((entry, index) => (
                  <tr
                    key={index}
                    className={entry.matched ? 'border-t border-slate-100' : 'border-t border-red-200 bg-red-50 text-red-700'}
                  >
                    <td className="py-2 pr-2">“{entry.quote}”</td>
                    <td className="py-2">
                      {entry.matched ? entry.paragraph_ref || 'stored extract' : 'No stored authority extract matches this wording'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {references.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Paragraph references</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Reference in draft</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {references.map((entry, index) => (
                  <tr
                    key={index}
                    className={entry.matched ? 'border-t border-slate-100' : 'border-t border-amber-200 bg-amber-50 text-amber-900'}
                  >
                    <td className="py-2 pr-2 font-mono text-xs">{entry.reference}</td>
                    <td className="py-2">
                      {entry.matched
                        ? 'Stored in an authority extract'
                        : 'Not in a stored authority extract. If this is a reference to one of our documents, write it in the structured form so it is checked against the document in check B.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {notices.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Main authorities in the library</h4>
            <ul className="space-y-1 text-sm">
              {notices.map((notice) => {
                if (!notice.hasExtract) {
                  return (
                    <li key={notice.id} className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {notice.name} {notice.citation} — no extract stored. Cite by name only: {NO_EXTRACT_MARKER}
                    </li>
                  );
                }
                if (!notice.checked) {
                  return (
                    <li key={notice.id} className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {notice.name} {notice.citation} — {NOT_CHECKED_MARKER}
                    </li>
                  );
                }
                return (
                  <li key={notice.id} className="text-green-800">
                    {notice.name} {notice.citation} — extracts checked against the official text
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}