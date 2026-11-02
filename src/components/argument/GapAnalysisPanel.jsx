import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, SearchCheck, Copy, Check, FileText } from 'lucide-react';
import { runGapAnalysis, saveFactListAnswers, saveSupplementaryStatement, summarise } from '@/lib/gapAnalysis';
import { buildSupplementaryStatement, SAFETY_FOOTER } from '@/lib/supplementaryStatement';

const STATUS_STYLE = {
  Covered: 'bg-green-100 text-green-900 border-green-300',
  'Partly covered': 'bg-amber-100 text-amber-900 border-amber-300',
  'Not covered': 'bg-red-100 text-red-900 border-red-300',
};

export default function GapAnalysisPanel({ matterId, matterName, court, ourPoints = [], tests = [], gap, onRefresh }) {
  const confirmed = tests.filter((test) => test.status === 'Confirmed by user');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState({});
  const [statement, setStatement] = useState('');
  const [statementOpen, setStatementOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [savingStatement, setSavingStatement] = useState(false);

  useEffect(() => {
    const next = {};
    (gap?.fact_list || []).forEach((item, index) => {
      next[item.key || `fact-${index + 1}`] = item.answer || '';
    });
    setAnswers(next);
  }, [gap?.id]);

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied('gap');
      setTimeout(() => setCopied(''), 1500);
    } catch (error) {
      setCopied('');
    }
  };

  const run = async () => {
    if (!matterId) return;
    setBusy(true);
    setMessage('');
    try {
      await runGapAnalysis({ matterId, matterName, ourPoints });
      setMessage('Gap analysis complete. The gap note is saved to the matter.');
      if (onRefresh) onRefresh();
    } catch (error) {
      setMessage(`Gap analysis failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const factListWithAnswers = () =>
    (gap?.fact_list || []).map((item, index) => {
      const key = item.key || `fact-${index + 1}`;
      const answer = (answers[key] || '').trim();
      return { ...item, key, answer, status: answer ? 'Answered' : 'FACT NEEDED' };
    });

  const saveAnswers = async () => {
    if (!gap) return;
    setBusy(true);
    try {
      await saveFactListAnswers(gap.id, factListWithAnswers());
      setMessage('Fact list answers saved.');
      if (onRefresh) onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const draftStatement = () => {
    const built = buildSupplementaryStatement({
      factList: factListWithAnswers(),
      matterName,
      court,
    });
    setStatement(built.text);
    setStatementOpen(true);
  };

  const saveStatement = async () => {
    if (!statement) return;
    setSavingStatement(true);
    try {
      await saveSupplementaryStatement({ matterId, matterName, text: statement });
      setMessage('Supplementary statement saved to the matter documents.');
      if (onRefresh) onRefresh();
    } finally {
      setSavingStatement(false);
    }
  };

  const counts = summarise(gap?.summary);

  return (
    <Card className="shadow-md" id="gap-analysis">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <SearchCheck className="h-5 w-5 text-slate-700" />
              Witness statement gap analysis
            </CardTitle>
            <CardDescription>
              Every element of each confirmed test, and each of Our points, checked against our witness statements,
              exhibits, the other side's statements, the N244 and the judgment.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={run}
            disabled={busy || !matterId || confirmed.length === 0}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SearchCheck className="h-4 w-4 mr-2" />}
            Check our witness statements against the test
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {confirmed.length === 0 && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Confirm a legal test first: the gap analysis runs element by element against it.
          </p>
        )}

        {message && <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">{message}</p>}

        {gap ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={STATUS_STYLE.Covered}>
                Covered {counts.covered}
              </Badge>
              <Badge variant="outline" className={STATUS_STYLE['Partly covered']}>
                Partly covered {counts.partly}
              </Badge>
              <Badge variant="outline" className={STATUS_STYLE['Not covered']}>
                Not covered {counts.notCovered}
              </Badge>
              <span className="text-xs text-slate-500">
                {counts.total} element{counts.total === 1 ? '' : 's'} across {gap.test_ids?.length || confirmed.length} test
                {(gap.test_ids?.length || confirmed.length) === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-left uppercase tracking-wide text-slate-500">
                    <th className="py-2 px-3">Element</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Where covered</th>
                    <th className="py-2 px-3">What is missing</th>
                    <th className="py-2 px-3">Issue for submissions</th>
                    <th className="py-2 px-3">Other side / judgment</th>
                  </tr>
                </thead>
                <tbody>
                  {(gap.element_results || []).map((row, index) => (
                    <tr key={index} className="border-t border-slate-100 align-top">
                      <td className="py-2 px-3 max-w-xs">
                        <p className="font-medium text-slate-800">
                          {row.test_name ? `${row.test_name} — ` : ''}Element {row.element_number}
                        </p>
                        <p className="text-slate-600">{row.element_text}</p>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={STATUS_STYLE[row.status] || ''}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs">
                        {row.covered_where || '—'}
                        {row.quote && <p className="text-slate-500 mt-1">“{row.quote}”</p>}
                      </td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs">{row.missing || '—'}</td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs">{row.bridge || '—'}</td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs">{row.other_side || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(gap.point_results || []).length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Our points</h4>
                <ul className="space-y-1">
                  {gap.point_results.map((row, index) => (
                    <li key={index} className="text-xs text-slate-700">
                      <Badge variant="outline" className={STATUS_STYLE[row.status] || ''}>
                        {row.status}
                      </Badge>{' '}
                      {row.point} {row.covered_where ? <span className="text-slate-500">— {row.covered_where}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-wide text-slate-500">Counsel's gap note</h4>
                <Button size="sm" variant="outline" onClick={() => copy(gap.gap_note || '')}>
                  {copied === 'gap' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  Copy gap note
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded p-3 max-h-72 overflow-y-auto">
{gap.gap_note || 'No gap note saved.'}
              </pre>
            </div>

            <div id="fact-list">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-xs uppercase tracking-wide text-slate-500">
                  Supplementary witness statement fact list
                </h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={saveAnswers} disabled={busy}>
                    Save answers
                  </Button>
                  <Button size="sm" onClick={draftStatement} className="bg-slate-900 hover:bg-slate-800">
                    <FileText className="h-3 w-3 mr-1" />
                    Draft supplementary statement
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {(gap.fact_list || []).map((item, index) => {
                  const key = item.key || `fact-${index + 1}`;
                  const answered = Boolean((answers[key] || '').trim());
                  return (
                    <div key={key} className="border border-slate-200 rounded p-2 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            answered
                              ? 'bg-green-100 text-green-900 border-green-300'
                              : 'bg-red-100 text-red-900 border-red-300'
                          }
                        >
                          {answered ? 'Answered' : '[FACT NEEDED]'}
                        </Badge>
                        {item.element && <span className="text-[11px] text-slate-500">Supports: {item.element}</span>}
                        {item.document_name && (
                          <span className="text-[11px] text-slate-500">Exhibit from: {item.document_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-800">{item.prompt}</p>
                      <Textarea
                        value={answers[key] || ''}
                        onChange={(event) => setAnswers((prev) => ({ ...prev, [key]: event.target.value }))}
                        placeholder="Type the facts only — no legal argument."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No gap analysis has been run for this matter yet. Confirm the test, then run the check.
          </p>
        )}
      </CardContent>

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplementary witness statement (draft)</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded p-3">{statement}</pre>
          <p className="text-[11px] text-slate-500">{SAFETY_FOOTER}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(statement)}>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button size="sm" onClick={saveStatement} disabled={savingStatement}>
              {savingStatement ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Save to matter documents
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}