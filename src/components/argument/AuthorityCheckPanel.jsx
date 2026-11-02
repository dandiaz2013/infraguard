import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, TriangleAlert, Wrench } from 'lucide-react';
import { findAuthorityQuotations, normalise } from '@/lib/authorityCheck';
import { buildRecordBlocks, matchRecordBlocks, stripDocumentRefs } from '@/lib/docReferences';
import AuthorityQuoteRow from '@/components/argument/AuthorityQuoteRow';
import QuoteLinkPicker from '@/components/argument/QuoteLinkPicker';
import QuoteEditBox from '@/components/argument/QuoteEditBox';
import MainAuthorityRow from '@/components/argument/MainAuthorityRow';
import ExtractPasteBox from '@/components/argument/ExtractPasteBox';
import TestFromMainAuthority from '@/components/argument/TestFromMainAuthority';

const NO_EXTRACT_RE = /\[NO EXTRACT:?([^\]]*)\]/gi;

function actionsFor(row) {
  if (row.resolved) return [];
  if (row.kind === 'record') return ['confirm', 'edit', 'ignore'];
  return ['extract', 'find', 'record', 'ignore', 'edit'];
}

function authorityFor(context, caseLaw, caseId, mainId) {
  if (caseId) return caseId;
  const hay = normalise(context);
  const byName = (caseLaw || []).find((record) => record.name && hay.includes(normalise(record.name)));
  if (byName) return byName.id;
  const byCitation = (caseLaw || []).find(
    (record) => record.neutral_citation && hay.includes(normalise(record.neutral_citation))
  );
  if (byCitation) return byCitation.id;
  return mainId || caseLaw?.[0]?.id || '';
}

function paragraphIn(context) {
  const match = String(context || '').match(/\bparas?\.?\s*(\d{1,3})/i);
  return match ? `para ${match[1]}` : '';
}

function Group({ title, count, tone = 'slate', hint, children }) {
  if (!count) return null;
  const tones = {
    red: 'text-red-800',
    slate: 'text-slate-700',
    blue: 'text-blue-800',
    green: 'text-green-800',
  };
  return (
    <div className="space-y-2">
      <h4 className={`text-xs uppercase tracking-wide font-medium ${tones[tone]}`}>
        {title} ({count})
      </h4>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function AuthorityCheckPanel({
  text,
  matterId = '',
  extracts = [],
  caseLaw = [],
  mainAuthorities = [],
  mainAuthorityId = '',
  documents = [],
  onRefresh,
  onEditDraft,
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(null);
  const [openAuthority, setOpenAuthority] = useState(null);

  const { data: decisionRows } = useQuery({
    queryKey: ['quoteDecisions', matterId],
    queryFn: () => base44.entities.QuoteDecision.filter({ matter_id: matterId }),
    enabled: Boolean(matterId),
  });

  const decisions = useMemo(
    () => (Array.isArray(decisionRows) ? decisionRows : decisionRows?.items || []),
    [decisionRows]
  );

  const cleaned = useMemo(() => stripDocumentRefs(text), [text]);
  const blocks = useMemo(() => buildRecordBlocks(documents), [documents]);

  const rows = useMemo(() => {
    const byKey = new Map((decisions || []).map((entry) => [entry.quote_key, entry]));

    return findAuthorityQuotations(cleaned, extracts).map((entry) => {
      const decision = byKey.get(entry.key);
      const base = {
        ...entry,
        authorityId: authorityFor(entry.context, caseLaw, entry.case_law_id, mainAuthorityId),
      };

      if (entry.matched) {
        return {
          ...base,
          kind: 'extract',
          resolved: true,
          resolution_note: `Quoted from the stored extract at para ${entry.paragraph_ref || 'not recorded'}.`,
        };
      }

      const inRecord = matchRecordBlocks(entry.quote, blocks);
      if (decision?.decision === 'record' || inRecord) {
        return {
          ...base,
          kind: 'record',
          resolved: decision?.decision === 'record',
          record_document: decision?.decision === 'record' ? decision.document_name : inRecord?.document_name,
          record_reference: decision?.decision === 'record' ? decision.paragraph_ref : inRecord?.reference,
          resolution_note: 'Linked to the record and checked in section B.',
        };
      }

      if (decision?.decision === 'ignore') {
        return { ...base, kind: 'unknown', resolved: true, resolution_note: 'Not a quotation. Ignored for this matter.' };
      }

      if (decision?.decision === 'edit') {
        return {
          ...base,
          kind: entry.attribution === 'case' ? 'fault' : 'unknown',
          resolved: true,
          resolution_note: `Wording corrected to “${decision.edited_text || ''}”.`,
        };
      }

      if (decision?.decision === 'extract') {
        return {
          ...base,
          kind: 'extract',
          resolved: true,
          resolution_note: 'The extract was added. Run the check again to confirm the wording.',
        };
      }

      return {
        ...base,
        kind: entry.attribution === 'case' ? 'fault' : 'unknown',
        resolved: false,
      };
    });
  }, [cleaned, extracts, decisions, blocks, caseLaw, mainAuthorityId]);

  const groups = useMemo(
    () => ({
      faults: rows.filter((row) => row.kind === 'fault'),
      unknowns: rows.filter((row) => row.kind === 'unknown'),
      records: rows.filter((row) => row.kind === 'record'),
      stored: rows.filter((row) => row.kind === 'extract'),
    }),
    [rows]
  );

  const faults = groups.faults.filter((row) => !row.resolved).length;

  const noExtract = useMemo(() => {
    const found = [];
    NO_EXTRACT_RE.lastIndex = 0;
    let match;
    while ((match = NO_EXTRACT_RE.exec(String(text || ''))) !== null) {
      const body = String(match[1] || '').replace(/^[\s:—-]+/, '').trim();
      if (body && !/^PARAGRAPH NEEDED$/i.test(body)) found.push(body);
    }
    return [...new Set(found)];
  }, [text]);

  const saveDecision = async (row, decision, extra = {}) => {
    if (!matterId) return;
    const existing = (decisions || []).find((entry) => entry.quote_key === row.key);
    const payload = {
      matter_id: matterId,
      quote_key: row.key,
      quote_text: row.quote,
      decision,
      ...extra,
    };

    if (existing) await base44.entities.QuoteDecision.update(existing.id, payload);
    else await base44.entities.QuoteDecision.create(payload);

    await queryClient.invalidateQueries({ queryKey: ['quoteDecisions', matterId] });
    setOpen(null);
    if (onRefresh) onRefresh();
  };

  const handle = (action, row) => {
    if (action === 'ignore') {
      saveDecision(row, 'ignore');
      return;
    }
    if (action === 'confirm') {
      saveDecision(row, 'record', {
        document_name: row.record_document || '',
        paragraph_ref: row.record_reference || '',
      });
      return;
    }
    setOpen((prev) =>
      prev && prev.key === row.key && prev.action === action
        ? null
        : { key: row.key, action, authorityId: row.authorityId }
    );
  };

  const editorFor = (row) => {
    if (!open || open.key !== row.key) return null;
    const authorityId = open.authorityId || row.authorityId;

    if (open.action === 'extract') {
      return (
        <ExtractPasteBox
          caseLaw={caseLaw}
          defaultCaseId={authorityId}
          defaultParagraph={paragraphIn(row.context)}
          defaultText={row.quote}
          proposition={row.context}
          onSaved={() => saveDecision(row, 'extract', { case_law_id: authorityId })}
        />
      );
    }

    if (open.action === 'find') {
      return (
        <TestFromMainAuthority
          matterId={matterId}
          authorities={caseLaw}
          extracts={extracts}
          tests={[]}
          selectedId={authorityId}
          onSelect={(id) => setOpen({ key: row.key, action: 'find', authorityId: id })}
          onRefresh={onRefresh}
        />
      );
    }

    if (open.action === 'record') {
      return (
        <QuoteLinkPicker
          quote={row.quote}
          documents={documents}
          onCancel={() => setOpen(null)}
          onSave={(link) => saveDecision(row, 'record', link)}
        />
      );
    }

    if (open.action === 'edit') {
      return (
        <QuoteEditBox
          quote={row.quote}
          onCancel={() => setOpen(null)}
          onSave={(edited) => {
            saveDecision(row, 'edit', { edited_text: edited });
            if (onEditDraft) onEditDraft(row.quote, edited);
          }}
        />
      );
    }

    return null;
  };

  if (!text) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {faults === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <TriangleAlert className="h-4 w-4 text-red-600" />
          )}
          A · Authority check
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          This checks quotations from cases against the paragraphs you have stored from those cases. Quotes from your
          own documents are checked in section B.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-800">
            From the record: checked in B — {groups.records.length}
          </span>
          <span className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            Case quotation with no stored extract — {groups.faults.length}
          </span>
          <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
            Could not tell what this is — {groups.unknowns.length}
          </span>
          <span
            className={`text-sm font-medium ${faults === 0 ? 'text-green-700' : 'text-red-700'}`}
          >
            {faults === 0 ? '0 faults' : `${faults} fault${faults === 1 ? '' : 's'} to fix`}
          </span>
        </div>

        {noExtract.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 space-y-2">
            <p className="text-xs text-amber-900">
              The draft states {noExtract.length} principle{noExtract.length === 1 ? '' : 's'} from a case with no
              stored extract, marked [NO EXTRACT]. Each one needs the paragraph before it can be relied on.
            </p>
            {noExtract.map((entry) => (
              <p key={entry} className="text-[11px] text-amber-900">
                {entry}
              </p>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() =>
                document.getElementById('extracts-needed')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              <Wrench className="h-3 w-3 mr-1" />
              Fix this
            </Button>
          </div>
        )}

        <Group
          title="Case quotation with no stored extract"
          count={groups.faults.length}
          tone="red"
          hint="The only real fault: a case is quoted but no paragraph from it is stored."
        >
          {groups.faults.map((row) => (
            <AuthorityQuoteRow key={row.key} row={row} actions={actionsFor(row)} onAction={handle}>
              {editorFor(row)}
            </AuthorityQuoteRow>
          ))}
        </Group>

        <Group title="Could not tell what this is" count={groups.unknowns.length} tone="slate">
          {groups.unknowns.map((row) => (
            <AuthorityQuoteRow key={row.key} row={row} actions={actionsFor(row)} onAction={handle}>
              {editorFor(row)}
            </AuthorityQuoteRow>
          ))}
        </Group>

        <Group title="From the record: checked in B" count={groups.records.length} tone="blue">
          {groups.records.map((row) => (
            <AuthorityQuoteRow key={row.key} row={row} actions={actionsFor(row)} onAction={handle}>
              {editorFor(row)}
            </AuthorityQuoteRow>
          ))}
        </Group>

        {groups.stored.length > 0 && (
          <Group title="Matching a stored extract" count={groups.stored.length} tone="green">
            {groups.stored.map((row) => (
              <AuthorityQuoteRow key={row.key} row={row} actions={[]} onAction={handle} />
            ))}
          </Group>
        )}

        {mainAuthorities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide font-medium text-slate-700">Main authorities</h4>
            {mainAuthorities.map((record) => (
              <div key={record.id} className="space-y-2">
                <MainAuthorityRow
                  record={record}
                  extracts={extracts}
                  onAction={(action) =>
                    setOpenAuthority((prev) =>
                      prev && prev.id === record.id && prev.action === action ? null : { id: record.id, action }
                    )
                  }
                />

                {openAuthority?.id === record.id && openAuthority.action === 'paste' && (
                  <ExtractPasteBox
                    caseLaw={caseLaw}
                    defaultCaseId={record.id}
                    onSaved={() => {
                      setOpenAuthority(null);
                      if (onRefresh) onRefresh();
                    }}
                  />
                )}

                {openAuthority?.id === record.id && openAuthority.action === 'find' && (
                  <TestFromMainAuthority
                    matterId={matterId}
                    authorities={caseLaw}
                    extracts={extracts}
                    tests={[]}
                    selectedId={record.id}
                    onSelect={(id) => setOpenAuthority({ id, action: 'find' })}
                    onRefresh={onRefresh}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}