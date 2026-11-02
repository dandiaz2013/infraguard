import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Paperclip, Plus } from 'lucide-react';

const PRIORITY_STYLE = {
  High: 'bg-red-100 text-red-800 border-red-200',
  Medium: 'bg-amber-100 text-amber-800 border-amber-200',
  Low: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function QuestionCard({ question, index, onChange, onConvert, onAttach, attaching }) {
  const answered = Boolean((question.answer || '').trim());

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-400">Q{index + 1}</span>
        <Badge variant="outline" className={PRIORITY_STYLE[question.priority] || PRIORITY_STYLE.Medium}>
          {question.priority || 'Medium'}
        </Badge>
        {question.affects && <Badge variant="outline" className="text-[11px]">Affects: {question.affects}</Badge>}
        {question.round > 1 && <Badge variant="outline" className="text-[11px]">Follow-up {question.round - 1}</Badge>}
        {question.status === 'Dont know' && <Badge variant="outline" className="text-[11px]">Don't know</Badge>}
        {question.status === 'Skipped' && <Badge variant="outline" className="text-[11px]">Skipped</Badge>}
      </div>

      <p className="text-sm font-medium text-slate-900">{question.question}</p>
      {question.why && (
        <p className="text-xs text-slate-600 mt-1">
          <span className="font-semibold">Why it matters:</span> {question.why}
        </p>
      )}

      <Textarea
        value={question.answer || ''}
        onChange={(event) => onChange(index, { answer: event.target.value, status: event.target.value.trim() ? 'Answered' : 'Open' })}
        placeholder="Your answer. Add the document and paragraph if you have them."
        rows={3}
        className="mt-2 text-sm"
      />

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input
          value={question.quote || ''}
          onChange={(event) => onChange(index, { quote: event.target.value })}
          placeholder="Paste a quote from a document (optional)"
          className="text-xs"
        />
        <Input
          value={question.document_name || ''}
          onChange={(event) => onChange(index, { document_name: event.target.value })}
          placeholder="Document name (optional)"
          className="text-xs"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
          <Paperclip className="h-3 w-3" />
          <span>{attaching ? 'Reading document...' : 'Attach a document'}</span>
          <input
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            className="hidden"
            disabled={attaching}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAttach(index, file);
              event.target.value = '';
            }}
          />
        </label>
        <Button size="sm" variant="ghost" onClick={() => onChange(index, { status: 'Dont know', answer: '' })}>
          Don't know
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange(index, { status: 'Skipped', answer: '' })}>
          Skip
        </Button>
        <Button size="sm" variant="outline" disabled={!answered} onClick={() => onConvert(index)}>
          <Plus className="h-3 w-3 mr-1" />
          Convert to Our point
        </Button>
      </div>

      {question.conflict && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="flex items-start gap-2 text-xs font-semibold text-red-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {question.conflict}
          </p>
          <p className="text-xs text-red-900 mt-1">Which is right, the document or your answer? Confirm below.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant={question.conflict_resolution === 'Document' ? 'default' : 'outline'} onClick={() => onChange(index, { conflict_resolution: 'Document' })}>
              The document is right
            </Button>
            <Button size="sm" variant={question.conflict_resolution === 'Answer' ? 'default' : 'outline'} onClick={() => onChange(index, { conflict_resolution: 'Answer' })}>
              My answer is right
            </Button>
          </div>
          {question.conflict_resolution && (
            <p className="text-[11px] text-red-900 mt-2">Confirmed: {question.conflict_resolution === 'Document' ? 'the document' : 'your answer'}.</p>
          )}
        </div>
      )}
    </div>
  );
}