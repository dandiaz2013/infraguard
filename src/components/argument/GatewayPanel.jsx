import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, CircleAlert, Gauge } from 'lucide-react';
import { INDICATIVE } from '@/lib/safety';
import IssueApproachPanel from '@/components/argument/IssueApproachPanel';
import { ceilingLine } from '@/lib/issueRating';
import { approachesFor } from '@/lib/issueApproach';

const RATING = {
  Strong: { Icon: CheckCircle2, className: 'bg-green-50 text-green-900 border-green-300' },
  Reasonable: { Icon: CheckCircle2, className: 'bg-lime-50 text-lime-900 border-lime-300' },
  Arguable: { Icon: CircleAlert, className: 'bg-amber-50 text-amber-900 border-amber-300' },
  Weak: { Icon: AlertTriangle, className: 'bg-red-50 text-red-900 border-red-300' }
};

function Answer({ label, answer, onOpenRecord }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      {answer ? (
        <>
          <p className="text-xs text-slate-800 line-clamp-1">“{answer.quote}”</p>
          <button
            type="button"
            onClick={() => onOpenRecord(answer.document_name, answer.ref)}
            className="text-[11px] text-blue-700 underline underline-offset-2"
          >
            {answer.document_name}, {answer.ref}
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-500">Nothing in the record.</p>
      )}
    </div>
  );
}

export default function GatewayPanel({
  issues = [],
  promptness,
  orderId,
  onOrderChange,
  onOpenRecord,
  record = {},
  extracts = [],
  savedByIssue = {},
  historyByIssue = {},
  onSaveApproach,
}) {
  const ceiling = ceilingLine(
    issues.map((issue) => ({
      label: issue.title,
      evidence: { rating: issue.rating },
      next_step: issue.next,
    }))
  );

  return (
    <Card className="shadow-md" id="gateway">
      <CardHeader>
        <CardTitle className="text-base">Gateway issues</CardTitle>
        <CardDescription>
          Seven issues, each with an Evidence rating and an Argument rating. {INDICATIVE}
        </CardDescription>
        {ceiling && (
          <p className="mt-1 flex items-start gap-1 rounded border border-slate-300 bg-slate-50 p-2 text-[11px] text-slate-800">
            <Gauge className="h-3 w-3 mt-0.5 flex-shrink-0" />
            {ceiling}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {issues.map((issue) => {
          const rating = RATING[issue.rating] || RATING.Weak;
          const Icon = rating.Icon;
          return (
            <div key={issue.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {issue.number}. {issue.title}
                  </p>
                  <p className="text-[11px] text-slate-600">{issue.ask}</p>
                </div>
                <Badge variant="outline" className={`flex items-center gap-1 ${rating.className}`}>
                  <Icon className="h-3 w-3" />
                  {issue.rating}
                </Badge>
              </div>

              {issue.id === 'promptness' && (
                <div className="rounded border border-slate-200 bg-slate-50 p-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-700">The order challenged</span>
                    <Select value={orderId || promptness?.order?.id || ''} onValueChange={onOrderChange}>
                      <SelectTrigger className="h-7 text-xs w-full sm:w-72">
                        <SelectValue placeholder="Pick an order from the record" />
                      </SelectTrigger>
                      <SelectContent>
                        {(promptness?.orders || []).map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.name} — {order.date_text}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-slate-800">{promptness?.note}</p>
                  {promptness?.application && (
                    <p className="text-[11px] text-slate-600">
                      Application: {promptness.application.name}, {promptness.application.ref} —{' '}
                      {promptness.application.date_text}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <Answer label="Our answer from the record" answer={issue.ours} onOpenRecord={onOpenRecord} />
                <Answer label="Their answer from the record" answer={issue.theirs} onOpenRecord={onOpenRecord} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 border-t border-slate-100 pt-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">The gap</p>
                  <p className="text-xs text-slate-800">{issue.gap}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Next step</p>
                  <p className="text-xs text-slate-800">{issue.next}</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-600">Why {issue.rating.toLowerCase()}: {issue.reason}</p>
              {issue.authority && (
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  Stored extract at paragraph {issue.authority.paragraph_ref || 'not recorded'}: “{issue.authority.quote}”
                </p>
              )}

              <IssueApproachPanel
                issue={issue}
                approaches={approachesFor(issue, record, extracts)}
                record={record}
                extracts={extracts}
                saved={savedByIssue[issue.id] || null}
                history={historyByIssue[issue.id] || []}
                onChange={onSaveApproach}
                onOpenRecord={onOpenRecord}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}