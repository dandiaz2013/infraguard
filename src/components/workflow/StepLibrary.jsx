import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Library, AlertTriangle } from 'lucide-react';
import DraftNotice from '@/components/workflow/DraftNotice';

const COUNTS = [
  { key: 'found', label: 'Found in documents' },
  { key: 'already_held', label: 'Already held' },
  { key: 'newly_added', label: 'Newly added' },
  { key: 'linked', label: 'Linked to this matter' },
];

export default function StepLibrary({ matter, files, authorities, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const unverified = authorities.filter((record) => record.verified !== true).length;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await base44.functions.invoke('extractMatterAuthorities', { matter_id: matter.id });
      if (response.data?.error) throw new Error(response.data.error);
      setResult(response.data);
      await onChanged();
    } catch (err) {
      setError(err.message || 'The documents could not be processed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Extract authorities from every document</h3>
            <p className="text-sm text-slate-600 mt-1">
              A rule-based reading of the {files.length} uploaded document{files.length === 1 ? '' : 's'}. Anything
              not already in the Case Law Library is added as unverified, with a link where one can be generated.
            </p>
          </div>
          <Button
            onClick={run}
            disabled={busy || files.length === 0}
            className="bg-slate-900 hover:bg-slate-800 flex-shrink-0"
          >
            <Library className="h-4 w-4 mr-2" />
            {busy ? 'Extracting...' : result ? 'Run again' : 'Build library'}
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

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {COUNTS.map((item) => (
              <Card key={item.key} className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{result[item.key] ?? 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-600">
                Scanned {result.documents_scanned} document{result.documents_scanned === 1 ? '' : 's'}.{' '}
                {result.already_linked > 0 && `${result.already_linked} authority(ies) were already linked. `}
                {result.held?.length > 0 &&
                  'Held authorities were left untouched and are not shown in the newly added list.'}
              </p>
            </CardContent>
          </Card>

          {result.no_link?.length > 0 && (
            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  No automatic link ({result.no_link.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-600">
                  These authorities were found but no reliable link could be generated. Find the judgment manually
                  before relying on it.
                </p>
                {result.no_link.map((entry, index) => (
                  <div key={`${entry.name}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{entry.name}</p>
                    <p className="text-xs text-slate-600">
                      {entry.citation || 'No neutral citation'} &middot; {entry.document}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.added?.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Newly added as unverified ({result.added.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.added.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{entry.name}</p>
                      <p className="text-xs text-slate-600">
                        {entry.citation || 'No neutral citation'} &middot; {entry.document}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">Unverified</Badge>
                      {entry.link ? (
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-slate-700 underline"
                        >
                          Link
                        </a>
                      ) : (
                        <span className="text-xs text-amber-700">No link</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <DraftNotice />
        </>
      )}

      {!result && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-600">
              {authorities.length} authorit{authorities.length === 1 ? 'y is' : 'ies are'} already linked to this
              matter, {unverified} of them unverified.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}