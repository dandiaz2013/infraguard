import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, FileText } from 'lucide-react';
import ProposedExtractRow from '@/components/authority/ProposedExtractRow';
import { LICENCE, SAFETY_FOOTER } from '@/lib/extractStatus';
import fileToBase64 from '@/lib/fileToBase64';

export default function AuthorityTestFinder({ record, matterId = '', points = [], onSaved, buttonLabel = '' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [showFallback, setShowFallback] = useState(false);

  const run = async (text) => {
    if (!record?.id) return;
    setBusy(true);
    setError('');
    try {
      const response = await base44.functions.invoke('findAuthorityTest', {
        case_law_id: record.id,
        matter_id: matterId,
        text: text || '',
        points: points.slice(0, 40),
      });
      const data = response.data || {};
      if (data.error) throw new Error(data.error);
      setResult(data);
      setShowFallback(false);
      if (onSaved) onSaved();
    } catch (invokeError) {
      setError(invokeError.message || 'Could not read that judgment.');
      setShowFallback(true);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fileBase64 = await fileToBase64(file);
      const response = await base44.functions.invoke('documentTextExtract', { fileName: file.name, fileBase64 });
      const text = response.data?.text || '';
      if (!text.trim()) throw new Error('No text could be read from that file.');
      await run(text);
    } catch (uploadError) {
      setError(uploadError.message || 'Could not read that file.');
    } finally {
      setUploading(false);
    }
  };

  const label = buttonLabel || `Find the test in ${record?.name || 'this authority'}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{record?.name || 'Authority'}</p>
          <p className="text-[11px] text-slate-500">
            One judgment, read once when you press the button. Paragraphs are split by rule and every proposed
            quotation is verified character for character before it is stored.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run('')} disabled={busy || !record?.id} className="bg-slate-900 hover:bg-slate-800">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            {label}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)} disabled={busy}>
            {open ? 'Hide' : 'Use a file or pasted text'}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <FileText className="h-3.5 w-3.5" />
            Upload the judgment text (.txt, .pdf, .docx)
          </label>
          <Input
            type="file"
            accept=".txt,.pdf,.docx"
            disabled={uploading || busy}
            onChange={(event) => upload(event.target.files?.[0])}
            className="text-xs"
          />
          {uploading && <p className="text-xs text-slate-500">Reading the file...</p>}
          <Textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder="Or paste the judgment text, with its paragraph numbers"
            rows={4}
            className="text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => run(paste)} disabled={busy || paste.trim().length < 200}>
            Find the test in this text
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
          {showFallback ? ' Upload or paste the judgment text above and try again.' : ''}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-slate-600">
            {result.source?.paragraph_count || 0} numbered paragraphs read
            {result.source?.truncated ? ' (stored text truncated)' : ''}. {result.proposed || 0} extract
            {result.proposed === 1 ? '' : 's'} stored as proposed
            {result.discarded ? `, ${result.discarded} discarded because the wording did not match the stored text` : ''}.
          </p>
          <p className="text-[11px] font-medium text-slate-700">{LICENCE}</p>

          {result.extracts?.length === 0 ? (
            <p className="text-sm text-slate-600">
              No paragraph in this judgment sets out a legal test that could be quoted exactly.
            </p>
          ) : (
            <div className="space-y-2">
              {(result.extracts || []).map((extract) => (
                <ProposedExtractRow
                  key={extract.id}
                  extract={extract}
                  caseRecord={record}
                  onSaved={onSaved}
                />
              ))}
            </div>
          )}

          {result.test && (
            <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              A proposed legal test “{result.test.name}” with {(result.test.elements || []).length} element
              {(result.test.elements || []).length === 1 ? '' : 's'} has been added to Legal tests. Confirm it only from
              extracts you have checked.
            </p>
          )}

          <p className="text-[11px] text-slate-500">{SAFETY_FOOTER}</p>
        </div>
      )}
    </div>
  );
}