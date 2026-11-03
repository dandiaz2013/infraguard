import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, ClipboardCheck, Copy, ListOrdered } from 'lucide-react';
import SectionCard from '@/components/draft/SectionCard';
import CounselReview from '@/components/draft/CounselReview';
import {
  sectionPlan,
  issueRecordBlocks,
  verifySection,
  assembleDraft,
  markerSummary,
  sectionProgress,
  wordCount,
  collectMarkers,
} from '@/lib/draftSections';
import { checkDocumentQuotes } from '@/lib/docReferences';
import { USER_MARKER } from '@/lib/fieldStates';

const AUTHORITY = /\{\{DOC:|\b(?:UKSC|UKHL|EWCA|EWHC|UKPC|Ch|WLR|All ER)\b|\b[A-Z][a-z]+ v [A-Z]/;

function unreferencedPassages(draft = '') {
  return String(draft || '')
    .split(/\n(?=\d{1,3}\.\s)/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 60 && !AUTHORITY.test(paragraph) && !paragraph.includes(USER_MARKER))
    .slice(0, 6)
    .map((paragraph) => ({
      kind: 'unreferenced',
      passage: paragraph.slice(0, 300),
      problem: 'No document reference and no authority in this paragraph.',
      fix: 'Add the record paragraph reference, or delete the sentence.',
    }));
}

// Section-by-section drafting: each gateway issue is drafted on its own, with the
// full record paragraphs it needs, then assembled and reviewed.
export default function SectionDraftPanel({
  matterId,
  argumentId,
  court,
  position,
  matterName,
  gateway = [],
  documents = [],
  record = {},
  extracts = [],
  authorityPool = [],
  approachByIssue = {},
  userStatements = [],
  onOpenRecord,
}) {
  const [sections, setSections] = useState([]);
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState([]);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const sectionsRef = useRef([]);

  const plan = useMemo(() => sectionPlan(gateway), [gateway]);

  const extractPayload = useMemo(
    () =>
      (extracts || []).map((extract) => {
        const authority = (authorityPool || []).find((entry) => entry.id === extract.case_law_id) || {};
        return {
          case_name: authority.name || '',
          citation: authority.neutral_citation || '',
          paragraph_ref: extract.paragraph_ref || '',
          extract_text: extract.extract_text || '',
          proposition: extract.proposition || '',
          checked:
            /checked against/i.test(extract.status || '') ||
            authority.check_status === 'Extract checked against official text',
        };
      }),
    [extracts, authorityPool]
  );

  useEffect(() => {
    if (!matterId) return undefined;
    let active = true;
    base44.entities.DraftSection.filter({ matter_id: matterId }, '-created_date', 200).then((rows) => {
      if (!active) return;
      const list = Array.isArray(rows) ? rows : rows?.items || [];
      const latest = new Map();
      list.forEach((row) => {
        if (!latest.has(row.section_key)) latest.set(row.section_key, row);
      });
      const sorted = [...latest.values()].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      sectionsRef.current = sorted;
      setSections(sorted);
    });
    return () => {
      active = false;
    };
  }, [matterId]);

  const progress = sectionProgress(sections, plan);

  const allBlocks = useMemo(() => {
    const seen = new Set();
    const blocks = [];
    gateway.forEach((issue) => {
      issueRecordBlocks(issue, documents, record).forEach((block) => {
        const key = `${block.document_name}::${block.ref}`;
        if (seen.has(key)) return;
        seen.add(key);
        blocks.push(block);
      });
    });
    return blocks;
  }, [gateway, documents, record]);

  const saveSection = async (entry, content, verify, status) => {
    const existing = sectionsRef.current.find((section) => section.section_key === entry.key);
    const data = {
      matter_id: matterId,
      argument_id: argumentId || '',
      section_key: entry.key,
      title: entry.title,
      order_index: plan.findIndex((item) => item.key === entry.key),
      content,
      word_count: wordCount(content),
      status,
      markers: (verify?.markers || collectMarkers(content)).map((marker) => ({ kind: marker.kind, text: marker.text })),
      verify: verify || {},
      drafted_at: new Date().toISOString(),
    };
    const saved = existing
      ? await base44.entities.DraftSection.update(existing.id, data)
      : await base44.entities.DraftSection.create(data);
    const merged = { ...(existing || {}), ...(saved || {}), ...data };
    const next = [...sectionsRef.current.filter((section) => section.section_key !== entry.key), merged].sort(
      (a, b) => (a.order_index || 0) - (b.order_index || 0)
    );
    sectionsRef.current = next;
    setSections(next);
    return merged;
  };

  const payloadFor = (entry, note) => {
    const issue = entry.issue;
    const approach = issue ? approachByIssue[issue.id] : null;
    const blocks = entry.kind === 'issue' ? issueRecordBlocks(issue, documents, record) : allBlocks.slice(0, 16);
    return {
      mode: 'section',
      court,
      position,
      matterName,
      section: { key: entry.key, title: entry.title, kind: entry.kind, ask: issue?.ask || '' },
      approach: approach
        ? [...(approach.approach_ids || []), approach.own_approach].filter(Boolean).join('; ')
        : '',
      explanation: approach?.explanation || '',
      record_paragraphs: blocks,
      other_side: issue?.theirs ? [issue.theirs] : [],
      extracts: extractPayload,
      user_statements: userStatements,
      issue_titles: gateway.map((item) => `${item.number}. ${item.title}`),
      note: note || '',
    };
  };

  const runSection = async (entry, note = '') => {
    if (entry.key === 'markers') return null;
    setBusy(entry.key);
    setMessage('');
    try {
      const response = await base44.functions.invoke('argumentSections', payloadFor(entry, note));
      if (response.data?.error) throw new Error(response.data.error);
      const content = response.data?.content || '';
      if (!content.trim()) throw new Error('Nothing came back for this section.');
      const verify = verifySection(content, documents, extractPayload);
      return await saveSection(entry, content, verify, note ? 'Redrafted' : 'Drafted');
    } catch (error) {
      setMessage(`${entry.title}: ${error.message}`);
      return null;
    } finally {
      setBusy('');
    }
  };

  const buildMarkers = async () => {
    const entry = plan.find((item) => item.key === 'markers');
    if (!entry) return;
    const markers = markerSummary(sectionsRef.current);
    const unchecked = extractPayload.filter((extract) => !extract.checked);
    const lines = ['Open markers and unsupported points', ''];
    if (markers.length) {
      markers.forEach((marker) => lines.push(`- ${marker.text} — in ${marker.section}`));
    } else {
      lines.push('- None.');
    }
    lines.push('', 'Unchecked authorities');
    if (unchecked.length) {
      unchecked.forEach((extract) =>
        lines.push(`- ${extract.case_name || 'unnamed authority'} ${extract.citation || ''}, paragraph ${extract.paragraph_ref || 'not recorded'}`)
      );
    } else {
      lines.push('- None.');
    }
    const content = lines.join('\n');
    await saveSection(entry, content, verifySection(content, documents, extractPayload), 'Drafted');
  };

  const draftAll = async () => {
    for (const entry of plan) {
      if (entry.key === 'markers') continue;
      const existing = sectionsRef.current.find((section) => section.section_key === entry.key);
      if (existing?.locked || (existing?.content || '').trim()) continue;
      await runSection(entry);
    }
    await buildMarkers();
  };

  const redraft = async (section) => {
    const entry = plan.find((item) => item.key === section.section_key);
    if (!entry || entry.kind === 'markers') {
      await buildMarkers();
      return;
    }
    await runSection(entry, section.section_key === 'intro' ? '' : '');
  };

  const toggleLock = async (section) => {
    const updated = await base44.entities.DraftSection.update(section.id, { locked: !section.locked });
    const next = sectionsRef.current.map((item) =>
      item.section_key === section.section_key ? { ...item, locked: !section.locked } : item
    );
    sectionsRef.current = next;
    setSections(next);
    return updated;
  };

  const runReview = async () => {
    setBusy('review');
    setMessage('');
    try {
      const ordered = plan
        .map((item) => sectionsRef.current.find((section) => section.section_key === item.key))
        .filter(Boolean);
      const draft = assembleDraft(ordered);
      if (!draft.trim()) throw new Error('Draft a section first.');

      const items = [];
      checkDocumentQuotes(draft, documents, extractPayload)
        .filter((entry) => entry.status === 'mismatch')
        .slice(0, 8)
        .forEach((entry) =>
          items.push({
            kind: 'conflict',
            passage: entry.quote,
            problem: `Not in the record. Closest text: ${entry.text || 'none in the uploaded documents'}.`,
            fix: 'Correct the quotation or remove it.',
        })
        );
      unreferencedPassages(draft).forEach((item) => items.push(item));
      ordered.forEach((section) =>
        collectMarkers(section.content || '').forEach((marker) =>
          items.push({
            kind: 'marker',
            passage: marker.text,
            problem: 'Open marker in the draft.',
            fix: 'Supply what the marker asks for, or remove the sentence.',
            section: section.title,
            section_key: section.section_key,
          })
        )
      );

      const response = await base44.functions.invoke('argumentSections', {
        mode: 'review',
        court,
        position,
        matterName,
        draft,
        record_paragraphs: allBlocks.slice(0, 40),
        extracts: extractPayload,
      });
      const passages = response.data?.passages || [];
      passages.slice(0, 8).forEach((passage) => {
        const owner = ordered.find((section) => (section.content || '').includes(String(passage.passage || '').slice(0, 60)));
        items.push({
          kind: 'weak',
          passage: passage.passage,
          problem: passage.problem,
          fix: passage.fix,
          section: owner?.title || '',
          section_key: owner?.section_key || '',
        });
      });
      setReview(items);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const fix = async (item) => {
    const entry = plan.find((section) => section.key === item.section_key);
    if (!entry) return;
    const updated = await runSection(entry, `${item.problem} ${item.fix}`);
    if (updated) setReview(review.filter((entryItem) => entryItem !== item));
  };

  const copyDraft = async () => {
    const ordered = plan
      .map((item) => sectionsRef.current.find((section) => section.section_key === item.key))
      .filter(Boolean);
    try {
      await navigator.clipboard.writeText(assembleDraft(ordered));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListOrdered className="h-5 w-5 text-slate-700" />
                Section by section
              </CardTitle>
              <CardDescription>
                {progress.drafted} of {progress.total} sections drafted. Each section is drafted on its own and
                checked against the record in code.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {progress.locked} locked
              </Badge>
              <Button size="sm" onClick={draftAll} disabled={Boolean(busy) || !gateway.length}>
                {busy && busy !== 'review' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                Draft all sections
              </Button>
              <Button size="sm" variant="outline" onClick={runReview} disabled={Boolean(busy)}>
                {busy === 'review' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ClipboardCheck className="h-3 w-3 mr-1" />}
                Counsel's review
              </Button>
              <Button size="sm" variant="outline" onClick={copyDraft} disabled={progress.drafted === 0}>
                <Copy className="h-3 w-3 mr-1" />
                {copied ? 'Copied' : 'Copy assembled draft'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-2 w-full rounded bg-slate-100">
            <div
              className="h-2 rounded bg-slate-800"
              style={{ width: `${progress.total ? Math.round((progress.drafted / progress.total) * 100) : 0}%` }}
            />
          </div>
          {message && <p className="text-xs text-red-700">{message}</p>}
          <p className="text-[11px] text-slate-500">
            Draft for review. Check every authority against the official judgment before filing. Not legal advice.
          </p>
        </CardContent>
      </Card>

      {plan.map((entry) => {
        const section = sections.find((item) => item.section_key === entry.key) || {
          section_key: entry.key,
          title: entry.title,
          content: '',
          status: 'Empty',
        };
        return (
          <SectionCard
            key={entry.key}
            section={section}
            busy={busy === entry.key}
            onRedraft={redraft}
            onToggleLock={toggleLock}
          />
        );
      })}

      <CounselReview items={review} onFix={fix} busy={Boolean(busy && busy !== 'review')} />
    </div>
  );
}