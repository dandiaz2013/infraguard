import React from 'react';
import { Button } from '@/components/ui/button';
import { NO_EXTRACT_MARKER } from '@/lib/authorityCheck';

export default function MainAuthorityRow({ record, extracts = [], onAction }) {
  const stored = extracts.filter((extract) => extract.case_law_id === record.id);
  const checked = stored.filter((extract) => extract.status === 'Extract checked against official text').length;
  const link = record.official_url || record.url || '';

  return (
    <div className="rounded border border-slate-200 p-2 space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">
          {record.name}
          {record.neutral_citation ? <span className="ml-1 font-normal text-slate-600">{record.neutral_citation}</span> : null}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onAction('find')}>
            Find the test
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onAction('paste')}>
            Paste paragraphs
          </Button>
          {link ? (
            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
              <a href={link} target="_blank" rel="noreferrer">
                Open official page
              </a>
            </Button>
          ) : (
            <span className="text-[11px] text-slate-500 self-center">No official page stored</span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-600">
        {stored.length} stored extract{stored.length === 1 ? '' : 's'} · {checked} checked against the official text
      </p>

      {stored.length === 0 && (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {NO_EXTRACT_MARKER} — the draft cites this case by name only because no paragraph has been stored.
        </p>
      )}
    </div>
  );
}