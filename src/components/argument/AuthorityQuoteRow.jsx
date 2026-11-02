import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, HelpCircle, Quote, TriangleAlert } from 'lucide-react';

const KINDS = {
  fault: {
    text: 'Case quotation with no stored extract',
    className: 'bg-red-50 text-red-800 border-red-200',
    Icon: TriangleAlert,
  },
  unknown: {
    text: 'Could not tell what this is',
    className: 'bg-slate-50 text-slate-700 border-slate-300',
    Icon: HelpCircle,
  },
  record: {
    text: 'From the record: checked in B',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
    Icon: FileText,
  },
  extract: {
    text: 'Matches a stored extract',
    className: 'bg-green-50 text-green-800 border-green-200',
    Icon: CheckCircle2,
  },
};

const BUTTON_LABELS = {
  confirm: 'Confirm the link',
  extract: 'Add the extract',
  find: 'Find it in the authority',
  record: 'This is from the record',
  ignore: 'Not a quote, ignore',
  edit: 'Edit the quote',
};

export default function AuthorityQuoteRow({ row, actions = [], onAction, children }) {
  const kind = KINDS[row.kind] || KINDS.unknown;
  const Icon = kind.Icon;

  return (
    <div className="rounded border border-slate-200 p-2 space-y-1.5">
      <p className="text-sm text-slate-900 flex gap-1.5">
        <Quote className="h-3.5 w-3.5 mt-1 flex-shrink-0 text-slate-400" />
        <span>“{row.quote}”</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`text-[11px] ${kind.className}`}>
          <Icon className="h-3 w-3 mr-1" />
          {kind.text}
        </Badge>

        {row.kind === 'record' && (row.record_document || row.record_reference) && (
          <span className="text-[11px] text-slate-600">
            {row.record_document}
            {row.record_reference ? `, ${row.record_reference}` : ''}
          </span>
        )}

        {row.kind === 'extract' && (
          <span className="text-[11px] text-slate-600">para {row.paragraph_ref || 'stored extract'}</span>
        )}

        {row.resolved && (
          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 text-[11px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        )}
      </div>

      {row.resolved && row.resolution_note && <p className="text-[11px] text-slate-600">{row.resolution_note}</p>}

      {!row.resolved && actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => onAction(action, row)}
            >
              {BUTTON_LABELS[action]}
            </Button>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}