import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DraftCitationCheck({ rows = [] }) {
  if (rows.length === 0) return null;
  const failed = rows.filter((row) => !row.verified).length;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {failed === 0 ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          Document references checked in code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-slate-500">
          {rows.length} reference{rows.length === 1 ? '' : 's'} and quotation
          {rows.length === 1 ? '' : 's'} checked against the ticked case file documents. {failed} could not be
          found.
        </p>
        <div className="space-y-1">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-start gap-2 text-xs">
              <Badge
                className={
                  row.verified
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-red-100 text-red-800 border-red-200'
                }
              >
                {row.kind === 'quote' ? 'Quotation' : 'Reference'}
              </Badge>
              <span className="text-slate-800 flex-1 min-w-0 truncate">{row.cited}</span>
              <span className="text-slate-500">{row.status}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}