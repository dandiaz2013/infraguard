import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, ShieldAlert } from 'lucide-react';

const KIND = {
  conflict: 'bg-red-50 text-red-900 border-red-300',
  unreferenced: 'bg-amber-50 text-amber-900 border-amber-300',
  marker: 'bg-slate-50 text-slate-700 border-slate-300',
  weak: 'bg-orange-50 text-orange-900 border-orange-300',
};

export default function CounselReview({ items = [], onFix, busy }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-slate-700" />
          Counsel's review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">No review run yet, or nothing was flagged.</p>
        ) : (
          items.map((item, index) => (
            <div key={index} className="rounded border border-slate-200 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className={`text-[10px] ${KIND[item.kind] || KIND.marker}`}>
                  {item.kind === 'conflict'
                    ? 'Conflicts with the record'
                    : item.kind === 'unreferenced'
                      ? 'No reference'
                      : item.kind === 'weak'
                        ? 'Weak passage'
                        : 'Open marker'}
                </Badge>
                {onFix && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onFix(item)}
                    disabled={busy}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Fix
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-800">“{String(item.passage || '').slice(0, 400)}”</p>
              <p className="text-[11px] text-slate-700">{item.problem}</p>
              {item.fix && <p className="text-[11px] text-slate-600">Fix: {item.fix}</p>}
              {item.section && <p className="text-[11px] text-slate-500">In: {item.section}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}