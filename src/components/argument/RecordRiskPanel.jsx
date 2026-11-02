import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/recordIndex';

const REMAINING_STYLE = {
  Closed: 'bg-green-100 text-green-900 border-green-300',
  Reduced: 'bg-sky-100 text-sky-900 border-sky-300',
  Unchanged: 'bg-amber-100 text-amber-900 border-amber-300',
  New: 'bg-red-100 text-red-900 border-red-300',
};

const RESULT_STYLE = {
  Yes: 'bg-green-50 text-green-800 border-green-200',
  Partly: 'bg-amber-50 text-amber-800 border-amber-200',
  No: 'bg-red-50 text-red-800 border-red-200',
};

export default function RecordRiskPanel({ risks = [] }) {
  if (risks.length === 0) return null;

  return (
    <Card className="shadow-md" id="record-risks">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-slate-700" />
          Gaps and risks, checked against the record first
        </CardTitle>
        <CardDescription>
          Each item was searched against the whole record before being put to you. A risk only moves down when the record
          or a stored authority supports it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.map((risk) => (
          <div key={risk.id} className="border border-slate-200 rounded p-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-800">{risk.label}</span>
              <Badge variant="outline" className={RESULT_STYLE[risk.result] || ''}>
                {risk.result}
              </Badge>
              <Badge variant="outline" className={REMAINING_STYLE[risk.remaining] || ''}>
                Remaining risk: {risk.remaining}
              </Badge>
              {risk.priority === 'High' && (
                <span className="text-[10px] uppercase tracking-wide text-slate-500">High priority</span>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Original risk: {risk.original} → What the record says:{' '}
              {risk.record_says.length === 0 ? 'nothing in the record on this point' : ''}
            </p>

            {risk.record_says.map((quote, index) => (
              <p key={index} className="text-[11px] text-slate-700">
                Stated by {ROLE_LABELS[quote.role] || quote.role} — {quote.document_name}, {quote.ref} — “{quote.quote}”
                {!quote.verified && <span className="text-red-700"> (quote not verified)</span>}
              </p>
            ))}

            {risk.conflict && (
              <p className="text-[11px] text-red-800">
                The record itself conflicts here: {ROLE_LABELS[risk.conflict.roles[0]]} refers to{' '}
                {risk.conflict.left.join(', ')} and {ROLE_LABELS[risk.conflict.roles[1]]} to{' '}
                {risk.conflict.right.join(', ')}. Say which is right.
              </p>
            )}

            <p className="text-[11px] text-slate-700">What would close it: {risk.what_would_close}</p>

            {risk.note && (
              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                {risk.note}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}