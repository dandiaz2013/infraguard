import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, SearchCheck, Copy, Check } from 'lucide-react';
import { runGapAnalysis, summarise } from '@/lib/gapAnalysis';

export default function GapAnalysisRunner({ matterId, matterName, className }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [gap, setGap] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const record = await runGapAnalysis({ matterId, matterName });
      setGap(record);
      setOpen(true);
    } catch (failure) {
      setError(failure.message);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(gap?.gap_note || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (failure) {
      setCopied(false);
    }
  };

  const counts = summarise(gap?.summary);

  return (
    <>
      <Button onClick={run} disabled={busy || !matterId} variant="outline" className={className}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SearchCheck className="h-4 w-4 mr-2" />}
        Check our witness statements against the test
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Witness statement gap analysis</DialogTitle>
          </DialogHeader>

          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-900 border-green-300">
                  Covered {counts.covered}
                </Badge>
                <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
                  Partly covered {counts.partly}
                </Badge>
                <Badge variant="outline" className="bg-red-100 text-red-900 border-red-300">
                  Not covered {counts.notCovered}
                </Badge>
              </div>

              <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded p-3 max-h-72 overflow-y-auto">
{gap?.gap_note || ''}
              </pre>

              <p className="text-xs text-slate-500">
                The fact list and the supplementary statement draft are on the Argument Builder page for this matter.
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={copy} disabled={!gap?.gap_note}>
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  Copy gap note
                </Button>
                <Link to={`/ArgumentBuilder?matter=${matterId}`}>
                  <Button size="sm">Open fact list</Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}