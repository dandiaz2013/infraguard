import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import { SAFETY_FOOTER, INDICATIVE } from '@/lib/safety';

const LIGHT = {
  Strong: { dot: 'bg-green-500', text: 'text-green-800', Icon: CheckCircle2 },
  Reasonable: { dot: 'bg-lime-500', text: 'text-lime-800', Icon: CheckCircle2 },
  Arguable: { dot: 'bg-amber-500', text: 'text-amber-800', Icon: CircleAlert },
  Weak: { dot: 'bg-red-500', text: 'text-red-800', Icon: AlertTriangle }
};

export default function CaseBrief({ brief, gateway, onOpenTab }) {
  const counts = gateway.reduce((acc, issue) => ({ ...acc, [issue.rating]: (acc[issue.rating] || 0) + 1 }), {});

  return (
    <Card className="shadow-md border-l-4 border-l-slate-900" id="case-brief">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Case Brief</CardTitle>
            <CardDescription>{INDICATIVE}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {['Strong', 'Arguable', 'Weak'].map((rating) => (
              <span key={rating} className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-full ${LIGHT[rating].dot}`} />
                {counts[rating] || 0} {rating.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">The issue</h4>
          <p className="mt-1 text-sm text-slate-900 line-clamp-2">{brief.issue}</p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Our case, from the record</h4>
          {brief.ourCase.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">No verified paragraph from our documents answers the gateway yet.</p>
          ) : (
            <ol className="mt-1 space-y-1">
              {brief.ourCase.slice(0, 5).map((line, index) => (
                <li key={index} className="text-sm text-slate-800">
                  <span className="font-medium">{index + 1}.</span> {line.text}
                  <span className="ml-1 text-[11px] text-slate-500">— {line.source}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">The seven gateway issues</h4>
          <div className="mt-2 space-y-1.5">
            {gateway.map((issue) => {
              const light = LIGHT[issue.rating] || LIGHT.Weak;
              return (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onOpenTab('gateway')}
                  className="w-full text-left flex items-start gap-2 rounded border border-slate-200 hover:border-slate-400 px-2 py-1.5"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${light.dot}`} />
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">
                      {issue.number}. {issue.title}
                    </span>
                    <span className={`ml-2 text-[11px] ${light.text}`}>{issue.rating}</span>
                    <span className="block text-[11px] text-slate-600 truncate">{issue.next}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top 5 actions</h4>
            <ol className="mt-1 space-y-1">
              {brief.actions.map((action, index) => (
                <li key={index} className="text-xs text-slate-800">
                  <span className="font-medium">{index + 1}.</span> {action.text}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">What is missing</h4>
            {brief.missing.length === 0 ? (
              <p className="mt-1 text-xs text-green-800">Nothing identified as missing from the record.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {brief.missing.map((item, index) => (
                  <li key={index} className="text-xs text-slate-800">
                    • {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 border-t pt-2">{SAFETY_FOOTER}</p>
      </CardContent>
    </Card>
  );
}