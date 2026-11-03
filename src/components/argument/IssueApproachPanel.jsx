import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpRight, Save, History } from 'lucide-react';
import { rateApproach, changeLine } from '@/lib/issueApproach';

const RATING_CLASS = {
  Strong: 'bg-green-100 text-green-900 border-green-300',
  Reasonable: 'bg-lime-100 text-lime-900 border-lime-300',
  Arguable: 'bg-amber-100 text-amber-900 border-amber-300',
  Weak: 'bg-red-100 text-red-900 border-red-300',
};

const STATUS_CLASS = {
  'Evidenced and backed by a checked authority': 'bg-green-50 text-green-900 border-green-300',
  Evidenced: 'bg-lime-50 text-lime-900 border-lime-300',
  'Explained, not evidenced': 'bg-amber-50 text-amber-900 border-amber-300',
  'Not addressed': 'bg-slate-50 text-slate-700 border-slate-300',
};

// Explain or choose an approach for one gateway issue, with the two ratings and
// a visible before -> after after every change.
export default function IssueApproachPanel({
  issue,
  approaches = [],
  record = {},
  extracts = [],
  saved = null,
  history = [],
  onChange,
  onOpenRecord,
}) {
  const [approachIds, setApproachIds] = useState(saved?.approach_ids || []);
  const [own, setOwn] = useState(saved?.own_approach || '');
  const [explanation, setExplanation] = useState(saved?.explanation || '');
  const [sourceDocument, setSourceDocument] = useState(saved?.source_document || '');
  const [sourceRef, setSourceRef] = useState(saved?.source_ref || '');

  const rated = useMemo(
    () =>
      rateApproach({
        issue,
        approachIds,
        ownApproach: own,
        explanation,
        source: { document_name: sourceDocument, ref: sourceRef },
        record,
        extracts,
        previous: saved
          ? { evidence: saved.evidence_rating, argument: saved.argument_rating }
          : null,
      }),
    [issue, approachIds, own, explanation, sourceDocument, sourceRef, record, extracts, saved]
  );

  const toggle = (id) => {
    setApproachIds(approachIds.includes(id) ? approachIds.filter((entry) => entry !== id) : [...approachIds, id]);
  };

  const save = () => {
    onChange?.(issue, {
      approach_ids: approachIds,
      own_approach: own.trim(),
      explanation: explanation.trim(),
      source_document: sourceDocument.trim(),
      source_ref: sourceRef.trim(),
      evidence_rating: rated.evidence.rating,
      argument_rating: rated.argument.rating,
      status: rated.status,
      changes: rated.changes,
    });
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Explain or choose an approach</p>
        <Badge variant="outline" className={`text-[10px] ${RATING_CLASS[rated.evidence.rating] || ''}`}>
          Evidence: {rated.evidence.rating}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${RATING_CLASS[rated.argument.rating] || ''}`}>
          Argument: {rated.argument.rating}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[rated.status] || ''}`}>
          {rated.status}
        </Badge>
      </div>

      <div className="space-y-2">
        {approaches.map((approach) => (
          <label
            key={approach.id}
            className={`block rounded border p-2 cursor-pointer ${
              approachIds.includes(approach.id) ? 'border-slate-800 bg-slate-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <Checkbox checked={approachIds.includes(approach.id)} onCheckedChange={() => toggle(approach.id)} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900">{approach.label}</p>
                <p className="text-[11px] text-slate-600">Supports: {approach.supports.join(' ')}</p>
                <p className="text-[11px] text-slate-600">Needs: {approach.needs}</p>
                <p className="text-[11px] text-slate-600">Main risk: {approach.risk}</p>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Or your own approach</p>
          <Textarea
            value={own}
            onChange={(event) => setOwn(event.target.value)}
            rows={2}
            className="text-xs"
            placeholder="In your words, how this issue should be put"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Your explanation</p>
          <Textarea
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            rows={2}
            className="text-xs"
            placeholder="Why the court should accept this"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={sourceDocument}
          onChange={(event) => setSourceDocument(event.target.value)}
          className="text-xs"
          placeholder="Optional: document the explanation points to"
        />
        <Input
          value={sourceRef}
          onChange={(event) => setSourceRef(event.target.value)}
          className="text-xs"
          placeholder="Optional: paragraph or page"
        />
      </div>

      {rated.changes.length > 0 && (
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          {rated.changes.map((change, index) => (
            <p key={index} className="flex items-start gap-1 text-[11px] text-slate-700">
              <ArrowUpRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
              {changeLine(change)}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save}>
          <Save className="h-3 w-3 mr-1" />
          Save this choice
        </Button>
        {saved && (
          <span className="text-[11px] text-slate-500">
            Saved: Evidence {saved.evidence_rating}, Argument {saved.argument_rating}
          </span>
        )}
      </div>

      {history.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <History className="h-3 w-3" />
            History for this issue
          </p>
          <ul className="mt-1 space-y-1">
            {history.map((entry) => (
              <li key={entry.id} className="text-[11px] text-slate-600">
                {entry.saved_at ? new Date(entry.saved_at).toLocaleString('en-GB') : 'saved'} — Evidence{' '}
                {entry.evidence_rating}, Argument {entry.argument_rating} ({entry.status})
                {(entry.changes || []).map((change, index) => (
                  <span key={index} className="block text-slate-500">
                    {changeLine(change)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rated.evidence.reasons.length > 0 && (
        <p className="text-[11px] text-slate-600">Evidence: {rated.evidence.reasons.join(' ')}</p>
      )}
      {onOpenRecord && issue.ours && (
        <button
          type="button"
          onClick={() => onOpenRecord(issue.ours.document_name, issue.ours.ref)}
          className="text-[11px] text-blue-700 underline underline-offset-2"
        >
          Open {issue.ours.document_name}, {issue.ours.ref}
        </button>
      )}
    </div>
  );
}