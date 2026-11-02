import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle2, Loader2, FileUp, ShieldCheck } from 'lucide-react';
import VerifiedBadge from '@/components/caselaw/VerifiedBadge';
import DraftNotice from '@/components/workflow/DraftNotice';
import fileToBase64 from '@/lib/fileToBase64';

function AuthorityRow({ record, busy, onVerify, onReadJudgment, recorded }) {
  const refs = recorded || record.principle_refs || [];

  return (
    <div className={`rounded-lg border p-4 ${record.verified ? 'border-green-200 bg-green-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={createPageUrl('CaseLawDetail') + '?id=' + record.id}
            className="text-sm font-semibold text-slate-900 hover:underline"
          >
            {record.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <VerifiedBadge verified={record.verified} />
            {record.neutral_citation && (
              <span className="text-xs font-mono text-slate-600">{record.neutral_citation}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {record.url ? (
            <a href={record.url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open link
              </Button>
            </a>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">No automatic link</Badge>
          )}

          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <FileUp className="h-4 w-4" />
            Add judgment
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                onReadJudgment(record, event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>

          {!record.verified && (
            <Button size="sm" onClick={() => onVerify(record)} disabled={busy} className="bg-green-700 hover:bg-green-800">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Tick verified
            </Button>
          )}
        </div>
      </div>

      {refs.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded principles</p>
          {refs.map((ref, index) => (
            <p key={index} className="text-sm text-slate-700">
              <span className="font-mono text-xs text-slate-500 mr-2">{ref.paragraph_ref || 'no paragraph'}</span>
              {ref.principle}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StepVerify({ matter, authorities, onChanged }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [recorded, setRecorded] = useState({});

  const pending = authorities.filter((record) => record.verified !== true);
  const verified = authorities.filter((record) => record.verified === true);

  const onVerify = async (record) => {
    setBusyId(record.id);
    setError('');
    try {
      await base44.entities.CaseLaw.update(record.id, { verified: true });
      await onChanged();
    } catch (err) {
      setError(err.message || 'That authority could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const onReadJudgment = async (record, file) => {
    if (!file) return;
    setBusyId(record.id);
    setError('');
    try {
      const fileBase64 = await fileToBase64(file);
      const extracted = await base44.functions.invoke('documentTextExtract', {
        fileName: file.name,
        fileBase64,
      });
      if (extracted.data?.error) throw new Error(extracted.data.error);

      const response = await base44.functions.invoke('recordAuthorityPrinciples', {
        case_law_id: record.id,
        text: extracted.data?.text || '',
      });
      if (response.data?.error) throw new Error(response.data.error);

      setRecorded((prev) => ({ ...prev, [record.id]: response.data.principle_refs || [] }));
      await onChanged();
    } catch (err) {
      setError(err.message || 'The judgment could not be read.');
    } finally {
      setBusyId('');
    }
  };

  if (authorities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-slate-600">
          No authorities are linked to this matter yet. Run step 3 first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm text-slate-600">
            Open each link, check the judgment on the official source, then tick it verified. Optionally upload the
            judgment and the principles will be recorded with their paragraph references.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {pending.length} unverified, {verified.length} verified.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Checklist - unverified ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <ShieldCheck className="h-4 w-4" />
              Every authority for this matter is verified.
            </div>
          ) : (
            pending.map((record) => (
              <AuthorityRow
                key={record.id}
                record={record}
                busy={busyId === record.id}
                onVerify={onVerify}
                onReadJudgment={onReadJudgment}
                recorded={recorded[record.id]}
              />
            ))
          )}
        </CardContent>
      </Card>

      {verified.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Verified ({verified.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verified.map((record) => (
              <AuthorityRow
                key={record.id}
                record={record}
                busy={busyId === record.id}
                onVerify={onVerify}
                onReadJudgment={onReadJudgment}
                recorded={recorded[record.id]}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <DraftNotice />
    </div>
  );
}