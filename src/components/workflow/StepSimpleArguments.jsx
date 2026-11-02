import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText } from 'lucide-react';
import DraftNotice from '@/components/workflow/DraftNotice';

function ArgumentCard({ entry }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <p className="text-sm text-slate-800">{entry.argument}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          {entry.basis_document}
        </Badge>
        {entry.basis_paragraph && (
          <span className="text-xs text-slate-500">{entry.basis_paragraph}</span>
        )}
      </div>
    </div>
  );
}

export default function StepSimpleArguments({ matter, files, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = matter.simple_arguments;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await base44.functions.invoke('caseWorkflowArguments', { matter_id: matter.id });
      if (response.data?.error) throw new Error(response.data.error);
      await base44.entities.Matter.update(matter.id, {
        simple_arguments: {
          issues: response.data.issues || [],
          our_arguments: response.data.our_arguments || [],
          their_arguments: response.data.their_arguments || [],
          documents_used: response.data.documents_used || 0,
        },
        simple_arguments_at: new Date().toISOString(),
      });
      await onChanged();
    } catch (err) {
      setError(err.message || 'The documents could not be analysed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Read the bundle, list the simple arguments</h3>
            <p className="text-sm text-slate-600 mt-1">
              The analysis reads only your {files.length} uploaded document{files.length === 1 ? '' : 's'} and gives
              3 to 6 plain-English arguments for each side, each tied to a document and paragraph.
            </p>
          </div>
          <Button
            onClick={run}
            disabled={busy || files.length === 0}
            className="bg-slate-900 hover:bg-slate-800 flex-shrink-0"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {busy ? 'Reading documents...' : saved ? 'Re-run analysis' : 'Analyse documents'}
          </Button>
        </CardContent>
      </Card>

      {files.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-600">
            Upload the case documents in step 1 first.
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {saved && (
        <>
          <DraftNotice />

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Main issues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(saved.issues || []).map((item, index) => (
                <div key={index} className="rounded-lg border-l-4 border-l-slate-900 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.issue}</p>
                  <p className="text-sm text-slate-600 mt-1">{item.plain_english}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Our arguments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(saved.our_arguments || []).map((entry, index) => (
                  <ArgumentCard key={index} entry={entry} />
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">The other party's arguments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(saved.their_arguments || []).map((entry, index) => (
                  <ArgumentCard key={index} entry={entry} />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}