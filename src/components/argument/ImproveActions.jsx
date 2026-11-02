import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench } from 'lucide-react';

const BUTTON_LABELS = {
  document: 'Add document',
  authority: 'Add authority extract',
  clause: 'Add contract clause',
  question: 'Answer a question',
  point: 'Add a point',
  test: 'Confirm the test',
  factlist: 'Open fact list',
};

const EFFORT_STYLE = {
  Low: 'bg-green-100 text-green-800 border-green-200',
  Medium: 'bg-amber-100 text-amber-800 border-amber-200',
  High: 'bg-red-100 text-red-800 border-red-200',
};

export default function ImproveActions({ actions, onAction }) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-5 w-5 text-slate-700" />
          Stage C · How to improve
        </CardTitle>
        <CardDescription>Biggest improvement first. The rating recalculates as you complete each one.</CardDescription>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm text-slate-600">No open gaps recorded against this version.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {actions.map((action) => (
              <div key={action.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{action.what_to_do}</p>
                  <p className="text-xs text-slate-600 mt-0.5">Fixes: {action.weakness}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">{action.effect}</Badge>
                    <Badge variant="outline" className={`text-[11px] ${EFFORT_STYLE[action.effort] || EFFORT_STYLE.Medium}`}>
                      Effort: {action.effort}
                    </Badge>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onAction(action.button)} className="flex-shrink-0">
                  {BUTTON_LABELS[action.button] || 'Do this'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}