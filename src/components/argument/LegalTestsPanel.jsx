import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Scale, ClipboardPaste } from 'lucide-react';
import LegalTestCard from '@/components/argument/LegalTestCard';
import ExtractPasteBox from '@/components/argument/ExtractPasteBox';

export default function LegalTestsPanel({ matterId, tests = [], extracts = [], caseLaw = [], onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [needed, setNeeded] = useState([]);
  const [message, setMessage] = useState('');

  const propose = async () => {
    if (!matterId) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await base44.functions.invoke('legalTests', { matter_id: matterId });
      const data = response.data || {};
      if (data.error) throw new Error(data.error);

      const proposals = data.tests || [];
      for (const proposal of proposals) {
        await base44.entities.LegalTest.create({
          matter_id: matterId,
          name: proposal.name || 'Legal test',
          source_case_law_id: proposal.source_case_law_id || '',
          source_extract_ids: (proposal.elements || []).map((element) => element.source_extract_id).filter(Boolean),
          elements: (proposal.elements || []).map((element, index) => ({
            number: index + 1,
            text: element.text || '',
            source_extract_id: element.source_extract_id || '',
            source_document_name: element.source_document_name || '',
            source_paragraph_ref: element.source_paragraph_ref || '',
            source_quote: element.source_quote || '',
            user_confirmed: false,
          })),
          notes: proposal.notes || '',
          status: 'Proposed',
        });
      }

      setNeeded(data.extract_needed || []);
      setMessage(
        proposals.length === 0
          ? 'No test could be proposed from the stored extracts or the uploaded documents.'
          : `${proposals.length} proposed test${proposals.length === 1 ? '' : 's'} added below. Check every element against the source, then confirm.`
      );
      if (onRefresh) onRefresh();
    } catch (error) {
      setMessage(`Could not propose a test: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-md" id="legal-tests">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-5 w-5 text-slate-700" />
              Legal tests
            </CardTitle>
            <CardDescription>
              Proposed only from stored authority extracts and passages in the uploaded documents. You confirm the
              elements; only confirmed tests are used in the checklist and in drafting.
            </CardDescription>
          </div>
          <Button size="sm" onClick={propose} disabled={busy || !matterId} className="bg-slate-900 hover:bg-slate-800">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Propose the legal test
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {message && <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">{message}</p>}

        {needed.length > 0 && (
          <div className="space-y-3">
            {needed.map((item) => (
              <div key={`${item.case_law_id}-${item.proposition}`} className="space-y-2">
                <p className="text-sm text-amber-900 flex items-start gap-2">
                  <ClipboardPaste className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  EXTRACT NEEDED: paste the paragraph from {item.case_name || 'the authority'} that sets out the test
                  {item.proposition ? ` (${item.proposition})` : ''}.
                </p>
                <ExtractPasteBox
                  caseLaw={caseLaw}
                  defaultCaseId={item.case_law_id || ''}
                  proposition={item.proposition || ''}
                  onSaved={() => {
                    if (onRefresh) onRefresh();
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {tests.length === 0 ? (
          <p className="text-sm text-slate-500">No legal test recorded for this matter yet.</p>
        ) : (
          <div className="space-y-3">
            {tests.map((test) => (
              <LegalTestCard
                key={test.id}
                test={test}
                extracts={extracts}
                caseLaw={caseLaw}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}