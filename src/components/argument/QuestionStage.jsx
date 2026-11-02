import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircleQuestion, ShieldAlert, CheckCircle2 } from 'lucide-react';
import QuestionCard from '@/components/argument/QuestionCard';
import RecordAnswer from '@/components/argument/RecordAnswer';
import { resolveFromRecord } from '@/lib/recordFirst';

export default function QuestionStage({
  questions, round, busy, conflictBusy, conflictChecked,
  onChange, onConvert, onAttach, attachingIndex,
  onAsk, onFollowUp, onCheckConflicts, onDraft, hasMatter, record,
}) {
  const answeredCount = questions.filter((question) => (question.answer || '').trim()).length;
  const openConflicts = questions.filter((question) => question.conflict && !question.conflict_resolution).length;

  const resolutions = React.useMemo(
    () =>
      questions.map((question) =>
        resolveFromRecord(record, `${question.question || ''} ${question.why || ''}`)
      ),
    [questions, record]
  );

  const fromRecord = resolutions.filter((resolution) => resolution.outcome === 'ANSWERED FROM RECORD').length;
  const stillToAsk = resolutions.filter((resolution) => resolution.outcome === 'NOT IN THE RECORD').length;
  const everythingInRecord = questions.length > 0 && stillToAsk === 0;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestion className="h-5 w-5 text-blue-700" />
          Stage A · Questions before drafting
        </CardTitle>
        <CardDescription>
          Every question is searched against the whole record first. Only what the record cannot answer is put to you.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasMatter && <p className="text-sm text-slate-600">Select a matter first.</p>}

        {hasMatter && questions.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600 mb-3">
              No questions yet. JurisAI searches the record first and only then asks what is still missing.
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
              <span>{fromRecord} from the record</span>
              <span>·</span>
              <span>Round {round} of 3</span>
              {openConflicts > 0 && (
                <span className="flex items-center gap-1 text-red-700 font-medium">
                  <ShieldAlert className="h-3 w-3" />
                  {openConflicts} conflict{openConflicts === 1 ? '' : 's'} to confirm
                </span>
              )}
            </div>

            {everythingInRecord && (
              <p className="flex items-center gap-2 text-sm text-green-900 bg-green-50 border border-green-200 rounded px-3 py-2">
                <CheckCircle2 className="h-4 w-4" />
                Everything needed is in the record. Confirm the answers and go straight to drafting.
              </p>
            )}

            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={index} className="space-y-1">
                  <RecordAnswer resolution={resolutions[index]} showSearched={false} />
                  <QuestionCard
                    question={question}
                    index={index}
                    onChange={onChange}
                    onConvert={onConvert}
                    onAttach={onAttach}
                    attaching={attachingIndex === index}
                  />
                </div>
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