import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Copy, Download, Save, CheckCircle2 } from 'lucide-react';
import DraftNotice from '@/components/workflow/DraftNotice';
import DraftCheckTable from '@/components/workflow/DraftCheckTable';

const POSITIONS = ['Claimant', 'Defendant', 'Appellant', 'Respondent'];

export default function StepArgument({ matter, authorities, arguments: existing, onSaved }) {
  const [position, setPosition] = useState('Claimant');
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [savedVersion, setSavedVersion] = useState(null);
  const [copied, setCopied] = useState(false);

  const unverifiedCount = authorities.filter((record) => record.verified !== true).length;
  const verifiedCount = authorities.length - unverifiedCount;

  const run = async () => {
    setBusy(true);
    setError('');
    setSavedVersion(null);
    try {
      const response = await base44.functions.invoke('workflowArgumentDraft', {
        matter_id: matter.id,
        position,
        include_unverified: includeUnverified,
      });
      if (response.data?.error) throw new Error(response.data.error);
      setDraft(response.data);
    } catch (err) {
      setError(err.message || 'The argument could not be drafted.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const versions = existing.map((item) => item.version_number || 0);
      const nextVersion = (versions.length ? Math.max(...versions) : 0) + 1;
      const latest = existing
        .slice()
        .sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];

      const step2Issues = matter.simple_arguments?.issues;
      const created = await base44.entities.Argument.create({
        matter_id: matter.id,
        version_number: nextVersion,
        argument_title: `Case Workflow argument - ${position} (v${nextVersion})`,
        position,
        court: matter.court || 'Not specified',
        argument_text: draft.draft_markdown,
        legal_issues: Array.isArray(step2Issues)
          ? step2Issues.map((item) => item.issue).filter(Boolean)
          : [],
        authorities: (draft.authorities_included || []).map((item) => item.id),
        status: 'Draft',
        parent_version_id: latest?.id || undefined,
      });
      setSavedVersion(created.version_number);
      await onSaved();
    } catch (err) {
      setError(err.message || 'The argument could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(draft.draft_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportFile = () => {
    const blob = new Blob([draft.draft_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(matter.matter_name || 'argument')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()}-${position.toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Draft the full argument</h3>
            <p className="text-sm text-slate-600 mt-1">
              The draft may cite only authorities held in the Case Law Library, exactly as stored. Anything the
              library does not cover is flagged as [AUTHORITY NEEDED].
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {verifiedCount} verified authorit{verifiedCount === 1 ? 'y' : 'ies'} available, {unverifiedCount}{' '}
              unverified.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="sm:w-56">
              <Label>We act for the</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="include-unverified"
                checked={includeUnverified}
                onCheckedChange={(value) => setIncludeUnverified(value === true)}
                disabled={unverifiedCount === 0}
              />
              <Label htmlFor="include-unverified" className="text-sm font-normal">
                Include unverified authorities (marked [UNVERIFIED - CHECK BEFORE USE])
              </Label>
            </div>

            <Button
              onClick={run}
              disabled={busy}
              className="bg-slate-900 hover:bg-slate-800 sm:ml-auto"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {busy ? 'Drafting...' : draft ? 'Draft again' : 'Draft argument'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {draft && (
        <>
          <DraftNotice />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportFile}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save as argument version'}
            </Button>
            {savedVersion && (
              <span className="text-sm text-green-700">Saved as version {savedVersion}.</span>
            )}
          </div>

          <DraftCheckTable checks={draft.checks} />

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm leading-relaxed text-slate-700 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mt-3 [&_h3]:font-semibold [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:mt-3 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-slate-200 [&_th]:py-1 [&_th]:text-left [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-1 [&_blockquote]:mt-3 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-3 [&_blockquote]:text-amber-800">
                <ReactMarkdown>{draft.draft_markdown}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}