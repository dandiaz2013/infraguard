import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DraftCheckTable({ checks }) {
  if (!checks || checks.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Citation check</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No neutral citations appear in this draft.</p>
        </CardContent>
      </Card>
    );
  }

  const mismatches = checks.filter((check) => !check.matched).length;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {mismatches === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          Citation check
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-sm ${mismatches === 0 ? 'text-green-700' : 'text-red-700'}`}>
          {checks.length - mismatches} of {checks.length} citation{checks.length === 1 ? '' : 's'} match a Case Law
          Library record{mismatches > 0 ? `, ${mismatches} do not` : ''}.
        </p>

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Citation in draft</th>
              <th className="py-2 pr-2">Library record</th>
              <th className="py-2">Stored paragraph</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check, index) => (
              <tr
                key={`${check.citation}-${index}`}
                className={
                  check.matched
                    ? 'border-t border-slate-100'
                    : 'border-t border-red-200 bg-red-50 text-red-700'
                }
              >
                <td className="py-2 pr-2 font-mono text-xs">{check.citation || '-'}</td>
                <td className="py-2 pr-2">
                  {check.matched ? check.library_name : check.problem}
                  {check.matched && !check.verified && (
                    <span className="ml-2 text-xs text-amber-700">unverified</span>
                  )}
                </td>
                <td className="py-2">{check.paragraph || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}