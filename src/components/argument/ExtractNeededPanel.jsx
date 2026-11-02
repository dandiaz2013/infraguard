import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardPaste } from 'lucide-react';
import { normalise } from '@/lib/authorityCheck';
import ExtractPasteBox from '@/components/argument/ExtractPasteBox';
import { searchRecord } from '@/lib/recordFirst';
import { ROLE_LABELS } from '@/lib/recordIndex';

const MARKER = /\[EXTRACT NEEDED:([^\]]+)\]/gi;

export default function ExtractNeededPanel({ text, caseLaw = [], record, onSaved }) {
  const markers = useMemo(() => {
    const found = [];
    const seen = new Set();
    let match;
    MARKER.lastIndex = 0;
    while ((match = MARKER.exec(String(text || ''))) !== null) {
      const body = match[1].trim();
      if (seen.has(body.toLowerCase())) continue;
      seen.add(body.toLowerCase());
      const [caseName, ...rest] = body.split(',');
      found.push({
        body,
        caseName: (caseName || '').trim(),
        proposition: rest.join(',').trim(),
      });
    }
    return found;
  }, [text]);

  if (markers.length === 0) return null;

  return (
    <Card className="shadow-sm border-amber-300">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-amber-700" />
          Extracts needed for propositions in this draft
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {markers.map((marker) => {
          const authorityRecord = caseLaw.find(
            (entry) =>
              normalise(entry.name) &&
              (normalise(marker.body).includes(normalise(entry.name)) ||
                normalise(entry.neutral_citation) && normalise(marker.body).includes(normalise(entry.neutral_citation)))
          );
          const inRecord = searchRecord(record, marker.body, 2).matches[0] || null;
          return (
            <div key={marker.body} className="space-y-2">
              <p className="text-sm text-amber-900">
                EXTRACT NEEDED: {marker.caseName ? `${marker.caseName}` : 'authority'}
                {marker.proposition ? ` — ${marker.proposition}` : ''}
              </p>
              {inRecord && (
                <p className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded px-2 py-1">
                  The record already contains this: {inRecord.document_name}, {inRecord.ref} — “{inRecord.quote}”
                  {' '}(stated by {ROLE_LABELS[inRecord.role] || inRecord.role})
                </p>
              )}
              <ExtractPasteBox
                caseLaw={caseLaw}
                defaultCaseId={authorityRecord?.id || ''}
                proposition={marker.proposition || marker.body}
                defaultParagraph={inRecord ? inRecord.ref.replace(/^para\s*/i, '') : ''}
                defaultText={inRecord ? inRecord.quote : ''}
                sourceNote={inRecord ? 'From the record - compare with official source' : ''}
                onSaved={onSaved}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}