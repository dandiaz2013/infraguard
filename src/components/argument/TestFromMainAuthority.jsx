import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { SAFETY_FOOTER } from '@/lib/safety';

// The test comes from the authority named as the main authority for THIS application.
// "Find the test" runs once on it, and the proposed extracts are ticked when compared.
export default function TestFromMainAuthority({
  matterId,
  authorities = [],
  extracts = [],
  tests = [],
  selectedId = '',
  onSelect,
  points = [],
  onRefresh
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paste, setPaste] = useState('');
  const attempted = useRef('');

  const chosen = authorities.find((record) => record.id === selectedId) || authorities[0] || null;
  const canFetch = Boolean(chosen && /^https?:\/\//i.test(String(chosen.official_url || chosen.url || '')));
  const stored = extracts
    .filter((extract) => extract.case_law_id === chosen?.id)
    .sort((a, b) => Number(String(a.paragraph_ref).match(/\d+/)?.[0] || 0) - Number(String(b.paragraph_ref).match(/\d+/)?.[0] || 0));
  const proposed = tests.filter((test) => test.source_case_law_id === chosen?.id);
  const background = tests.filter((test) => test.usage === 'Background: tests applied in the earlier decision');

  const run = async (text = paste) => {
    if (!chosen?.id || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await base44.functions.invoke('findAuthorityTest', {
        case_law_id: chosen.id,
        matter_id: matterId || '',
        text: text || '',
        points: points.slice(0, 40)
      });
      const data = response.data || {};
      if (data.error) throw new Error(data.error);
      setMessage(
        `${data.source?.paragraph_count || 0} paragraphs read. ${data.proposed || 0} extract${
          data.proposed === 1 ? '' : 's'
        } stored as proposed. Tick each one once you have compared it with the official text.`
      );
      if (onRefresh) onRefresh();
    } catch (error) {
      setMessage(`Could not read that judgment: ${error.message}. Upload or paste the judgment text instead.`);
    } finally {
      setBusy(false);
    }
  };

  // Run once, automatically, on the main authority for this application.
  useEffect(() => {
    if (!chosen?.id || !canFetch || stored.length > 0) return;
    if (attempted.current === chosen.id) return;
    attempted.current = chosen.id;
    run('');
  }, [chosen?.id, canFetch, stored.length]);

  const tick = async (extract, checked) => {
    await base44.entities.AuthorityExtract.update(extract.id, {
      status: checked ? 'Extract checked against official text' : 'Proposed - compare with the official text',
      checked_date: new Date().toISOString()
    });
    if (onRefresh) onRefresh();
  };

  // Confirming the test for this application: it stays tied to the authority named here.
  const confirm = async (test) => {
    await base44.entities.LegalTest.update(test.id, {
      status: 'Confirmed by user',
      usage: 'Gateway application',
      source_case_law_id: chosen?.id || test.source_case_law_id || ''
    });
    if (onRefresh) onRefresh();
  };

  if (authorities.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-base">The test</CardTitle>
          <CardDescription>
            Mark the authority that sets the test for this application as a main authority in the Case Law Library. No
            test is taken from the judgment being challenged.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-md" id="main-authority-test">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">The test, from the main authority</CardTitle>
            <CardDescription>
              The test for this application comes only from the authority you name here. Nothing is taken from the
              judgment being challenged.
            </CardDescription>
          </div>
          <Select value={chosen?.id || ''} onValueChange={onSelect}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-80">
              <SelectValue placeholder="Choose the main authority" />
            </SelectTrigger>
            <SelectContent>
              {authorities.map((record) => (
                <SelectItem key={record.id} value={record.id}>
                  {record.name}
                  {record.neutral_citation ? ` — ${record.neutral_citation}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {busy && (
          <p className="flex items-center gap-2 text-xs text-slate-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the judgment once…
          </p>
        )}
        {message && <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1">{message}</p>}

        {stored.length === 0 && !busy ? (
          <p className="text-xs text-slate-500">No stored extract from this authority yet.</p>
        ) : (
          <div className="space-y-2">
            {stored.map((extract) => {
              const checked = extract.status === 'Extract checked against official text';
              return (
                <div key={extract.id} className="rounded border border-slate-200 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-[11px]">para {extract.paragraph_ref || 'not recorded'}</Badge>
                    <div className="flex items-center gap-2">
                      {checked ? (
                        <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">Compared</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">Not compared</Badge>
                      )}
                      <label className="flex items-center gap-1 text-[11px] text-slate-700">
                        <Checkbox checked={checked} onCheckedChange={(value) => tick(extract, value === true)} />
                        Compared with the official text
                      </label>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-800">“{extract.extract_text}”</p>
                </div>
              );
            })}
          </div>
        )}

        {!busy && stored.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => run('')}>
            Find the test again
          </Button>
        )}

        {!canFetch && !busy && (
          <div className="rounded border border-slate-200 bg-slate-50 p-2 space-y-2">
            <p className="text-[11px] text-slate-700">
              No official link is stored for this authority. Paste the judgment text here once, with its paragraph
              numbers, and the proposed extracts will be stored for you to tick.
            </p>
            <textarea
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              rows={4}
              placeholder="Paste the judgment text, with its paragraph numbers"
              className="w-full rounded-md border border-input bg-background p-2 text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => run(paste)} disabled={paste.trim().length < 200}>
              Read this text
            </Button>
          </div>
        )}

        {proposed.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-700">Proposed tests from this authority</p>
            {proposed.map((test) => (
              <div key={test.id} className="rounded border border-slate-200 p-2 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-900">{test.name}</span>
                  {test.status === 'Confirmed by user' ? (
                    <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                      Confirmed
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => confirm(test)}>
                      Confirm this test
                    </Button>
                  )}
                </div>
                {(test.elements || []).map((element, index) => (
                  <p key={index} className="text-[11px] text-slate-700">
                    {element.source_paragraph_ref ? `para ${element.source_paragraph_ref}` : 'paragraph not recorded'} — “
                    {element.text}”
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {background.length > 0 && (
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] font-medium text-slate-700">Background: tests applied in the earlier decision</p>
            {background.map((test) => (
              <p key={test.id} className="text-[11px] text-slate-600">
                {test.name}
                {(test.elements || []).length ? ` — ${test.elements.length} element${test.elements.length === 1 ? '' : 's'}` : ''}
              </p>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-500 border-t pt-2">{SAFETY_FOOTER}</p>
      </CardContent>
    </Card>
  );
}