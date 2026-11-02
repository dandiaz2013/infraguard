import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircleQuestion, ShieldAlert } from 'lucide-react';
import QuestionCard from '@/components/argument/QuestionCard';

export default function QuestionStage({
  questions, round, busy, conflictBusy, conflictChecked,
  onChange, onConvert, onAttach, attachingIndex,
  onAsk, onFollowUp, onCheckConflicts, onDraft, hasMatter,
}) {
  const answeredCount = questions.filter((question) => (question.answer || '').trim()).length;
  const openConflicts = questions.filter((question) => question.conflict && !question.conflict_resolution).length;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestion className="h-5 w-5 text-blue-700" />
          Stage A · Questions before drafting
        </CardTitle>
        <CardDescription>
          The questions are built only from this matter's documents, your points, the stored extracts and the clauses you recorded. Answer what you can, then draft.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasMatter && <p className="text-sm text-slate-600">Select a matter first.</p>}

        {hasMatter && questions.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600 mb-3">
              No questions yet. JurisAI will ask 5 to 12, most important first, and will not invent any fact.
            </p>
            <Button onClick={onAsk} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4 mr-2" />}
              {busy ? 'Preparing questions...' : 'Ask the questions'}
            </Button>
          </div>
        )}

        {questions.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>{questions.length} question{questions.length === 1 ? '' : 's'}</span>
              <span>·</span>
              <span>{answeredCount} answered</span>
              <span>·</span>
              <span>Round {round} of 3</span>
              {openConflicts > 0 && (
                <span className="flex items-center gap-1 text-red-700 font-medium">
                  <ShieldAlert className="h-3 w-3" />
                  {openConflicts} conflict{openConflicts === 1 ? '' : 's'} to confirm
                </span>
              )}
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <QuestionCard
                  key={index}
                  question={question}
                  index={index}
                  onChange={onChange}
                  onConvert={onConvert}
                  onAttach={onAttach}
                  attaching={attachingIndex === index}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onCheckConflicts} disabled={conflictBusy || answeredCount === 0}>
                {conflictBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                {conflictChecked ? 'Check answers again' : 'Check answers against the documents'}
              </Button>
              <Button variant="outline" onClick={onFollowUp} disabled={busy || round >= 3}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Ask follow-up questions{round >= 3 ? ' (both rounds used)' : ''}
              </Button>
              <Button onClick={onDraft} disabled={answeredCount === 0} className="bg-blue-600 hover:bg-blue-700">
                Draft with these answers
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}