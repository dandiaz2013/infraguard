import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, RefreshCw, Loader2, FileWarning } from 'lucide-react';

const STATUS = {
  Drafted: 'bg-green-50 text-green-900 border-green-300',
  Redrafted: 'bg-lime-50 text-lime-900 border-lime-300',
  Failed: 'bg-red-50 text-red-900 border-red-300',
  Empty: 'bg-slate-50 text-slate-700 border-slate-300',
};

export default function SectionCard({ section, busy, onRedraft, onToggleLock, onOpenSection }) {
  const verify = section.verify || {};
  const problems = (verify.unresolved || 0) + (verify.mismatched || 0);

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{section.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <Badge variant="outline" className={`text-[10px] ${STATUS[section.status] || STATUS.Empty}`}>
              {section.status || 'Empty'}
            </Badge>
            <span>{section.word_count || 0} words</span>
            <span>{verify.references || 0} references</span>
            {problems > 0 && (
              <span className="flex items-center gap-1 text-red-700">
                <FileWarning className="h-3 w-3" />
                {problems} to fix
              </span>
            )}
            {(section.markers || []).length > 0 && (
              <span className="text-amber-800">{(section.markers || []).length} open markers</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-600">
            <Checkbox checked={Boolean(section.locked)} onCheckedChange={() => onToggleLock(section)} />
            <Lock className="h-3 w-3" />
            Locked
          </label>
          <Button size="sm" variant="outline" onClick={() => onRedraft(section)} disabled={busy || section.locked}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Redraft
          </Button>
        </div>
      </div>
      <div className="p-3">
        {section.content ? (
          <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs text-slate-800 leading-relaxed">
            {section.content}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Not drafted yet.</p>
        )}
        {section.content && (
          <p className="mt-2 text-[11px] text-slate-500">
            Checked in code: {verify.references || 0} reference{(verify.references || 0) === 1 ? '' : 's'},{' '}
            {verify.quotes || 0} quotation{(verify.quotes || 0) === 1 ? '' : 's'}
            {verify.user_statements ? `, ${verify.user_statements} statement${verify.user_statements === 1 ? '' : 's'} by you` : ''}.
          </p>
        )}
      </div>
    </div>
  );
}