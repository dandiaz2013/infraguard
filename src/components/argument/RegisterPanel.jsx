import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Loader2, RefreshCw } from 'lucide-react';
import RegisterItemCard from '@/components/argument/RegisterItemCard';

const MARK_LABELS = {
  conflicts: 'conflicts marked',
  open: 'open markers left',
  userStatements: 'unsupported points marked',
};

export default function RegisterPanel({
  register, record, onAnswer, onUpload, onFixCitation, onUseProposal, onRerun, busy, changes = [], marks = null,
}) {
  const [showAll, setShowAll] = useState(false);
  if (!register) return null;

  const list = showAll ? register.items : register.top;

  return (
    <Card className="shadow-md" id="register">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-5 w-5 text-slate-700" />
          The register
        </CardTitle>
        <CardDescription>
          Every risk and gap in one list, taken the same way: what it is, what the record says, one question, then the result.
          A risk only closes when a verified record quotation answers it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{register.summary.total} items</Badge>
          <Badge variant="outline" className={register.summary.unresolved ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-green-50 border-green-300 text-green-900'}>
            {register.summary.unresolved} still open
          </Badge>
          <Button size="sm" variant="outline" className="ml-auto" onClick={onRerun} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Re-run using my answers
          </Button>
        </div>

        {register.allDone ? (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded p-2">
            No questions. Everything needed is in the record or confirmed by you.
          </p>
        ) : (
          <p className="text-xs text-slate-600">
            {showAll ? 'Every item, most serious first.' : 'The five questions that matter most, in order.'}
          </p>
        )}

        <div className="space-y-3">
          {list.map((item) => (
            <RegisterItemCard
              key={item.id}
              item={item}
              record={record}
              onAnswer={(patch) => onAnswer(item, patch)}
              onUpload={onUpload}
              onFixCitation={onFixCitation}
              onUseProposal={onUseProposal}
            />
          ))}
        </div>

        {register.items.length > list.length && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>Show all {register.items.length} items</Button>
        )}
        {showAll && register.items.length > register.top.length && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(false)}>Show only the top 5</Button>
        )}

        {marks && (
          <p className="text-[11px] text-slate-600 border-t border-slate-100 pt-2">
            Draft markers: {marks.conflicts} {MARK_LABELS.conflicts}, {marks.open} {MARK_LABELS.open}, {marks.userStatements}{' '}
            {MARK_LABELS.userStatements}.
          </p>
        )}

        {changes.length > 0 && (
          <div className="border-t border-slate-100 pt-2">
            <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">What changed in the draft</h5>
            <ul className="mt-1 space-y-1">
              {changes.map((change) => (
                <li key={change.id} className="text-[11px] text-slate-700">
                  <span className={change.status === 'in the draft' ? 'text-green-700' : 'text-amber-700'}>{change.status}</span>
                  {' — '}{change.title} <span className="text-slate-400">({change.why})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}