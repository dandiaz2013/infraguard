import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Gauge, TrendingUp, TriangleAlert } from 'lucide-react';
import { SAFETY_FOOTER } from '@/lib/safety';

const RATING_STYLE = {
  Weak: 'bg-red-100 text-red-900 border-red-300',
  Arguable: 'bg-amber-100 text-amber-900 border-amber-300',
  Reasonable: 'bg-lime-100 text-lime-900 border-lime-300',
  Strong: 'bg-green-100 text-green-900 border-green-300'
};

function SourceLine({ text }) {
  return <p className="text-[11px] text-slate-500 mt-0.5">{text}</p>;
}

function AssessmentList({ title, items, render }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-1 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="text-xs text-slate-700">
            {render(item)}
            {item.source && <SourceLine text={item.source} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Prospects come from the seven gateway issues: the weakest issue sets the ceiling.
export default function ProspectsPanel({ rating, explanation, issues = [], savedRating, history, assessment, isAssessing, onAssess, canAssess }) {
  const moved = savedRating && savedRating !== rating;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-5 w-5 text-slate-700" />
              Prospects
            </CardTitle>
            <CardDescription>Set by the weakest of the seven gateway issues. Indicative only.</CardDescription>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={`text-sm px-3 py-1 ${RATING_STYLE[rating] || RATING_STYLE.Weak}`}>
              {rating}
            </Badge>
            {moved && (
              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-600">
                <TrendingUp className="h-3 w-3" />
                Saved as {savedRating}, now {rating}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-slate-700">{explanation}</p>

        {history && history.length > 0 && (
          <p className="text-xs text-slate-500 border-t pt-2">
            <span className="font-semibold text-slate-700">Prospects history: </span>
            {history.map((entry) => `v${entry.version} ${entry.rating}`).join('  →  ')}
            {'  →  '}
            <span className="font-medium text-slate-800">now {rating}</span>
          </p>
        )}

        <div className="space-y-1 border-t pt-2">
          {issues.map((issue) => (
            <p key={issue.id} className="text-xs text-slate-700">
              <span className="font-medium text-slate-900">{issue.number}. {issue.title}</span> — {issue.rating}: {issue.reason}
            </p>
          ))}
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-start gap-2 text-xs text-amber-900">
            <TriangleAlert className="h-4 w-4 flex-shrink-0" />
            {SAFETY_FOOTER}
          </p>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Written assessment</h3>
            <Button size="sm" variant="outline" onClick={onAssess} disabled={isAssessing || !canAssess}>
              {isAssessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {assessment ? 'Run again' : 'Run the assessment'}
            </Button>
          </div>

          {!assessment && !isAssessing && (
            <p className="text-xs text-slate-500 mt-2">
              Uses only the argument, your documents and the stored extracts. Anything it cannot support is shown as an
              open question.
            </p>
          )}

          {assessment && (
            <div className="mt-3 space-y-4">
              <AssessmentList title="Strongest points" items={assessment.strongest} render={(item) => item.point} />
              <AssessmentList title="Weakest points" items={assessment.weakest} render={(item) => item.point} />

              {assessment.counter_arguments?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">The three best counter-arguments against us</h4>
                  <ul className="mt-1 space-y-2">
                    {assessment.counter_arguments.map((item, index) => (
                      <li key={index} className="text-xs text-slate-700">
                        <p className="font-medium">{item.their_argument}</p>
                        <p className="mt-0.5">Our answer: {item.our_answer}</p>
                        {item.source && <SourceLine text={item.source} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <AssessmentList title="Risks" items={assessment.risks} render={(item) => item.risk} />

              {assessment.open_questions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Open questions</h4>
                  <ul className="mt-1 space-y-1">
                    {assessment.open_questions.map((question, index) => (
                      <li key={index} className="text-xs text-slate-700">• {question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}