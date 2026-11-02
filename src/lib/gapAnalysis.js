// Shared runner for the witness statement gap analysis, used by the Argument page and the Matter page.
import { base44 } from '@/api/base44Client';

export async function runGapAnalysis({ matterId, matterName = '', ourPoints = [], argumentId = '' }) {
  const response = await base44.functions.invoke('witnessGapAnalysis', {
    matter_id: matterId,
    argument_id: argumentId || '',
    our_points: ourPoints || [],
  });

  const data = response.data || {};
  if (data.error) throw new Error(data.error);

  const factList = (data.fact_list || []).map((item, index) => ({
    key: item.key || `fact-${index + 1}`,
    element: item.element || '',
    prompt: item.prompt || '',
    document_name: item.document_name || '',
    paragraph_ref: item.paragraph_ref || '',
    answer: '',
    status: 'FACT NEEDED',
  }));

  const record = await base44.entities.GapAnalysis.create({
    matter_id: matterId,
    argument_id: argumentId || '',
    test_ids: data.test_ids || [],
    element_results: data.element_results || [],
    point_results: data.point_results || [],
    gap_note: data.gap_note || '',
    fact_list: factList,
    summary: data.summary || {},
    generated_at: new Date().toISOString(),
  });

  if (data.gap_note) {
    await base44.entities.Document.create({
      matter_id: matterId,
      document_type: 'Other',
      title: `Counsel's Gap Note — ${matterName || 'Matter'}`,
      content: data.gap_note,
      status: 'Draft',
      notes: 'Witness statement gap analysis. Draft for review.',
    });
  }

  return record;
}

export async function saveFactListAnswers(gapId, factList) {
  return base44.entities.GapAnalysis.update(gapId, { fact_list: factList });
}

export async function saveSupplementaryStatement({ matterId, matterName, text }) {
  return base44.entities.Document.create({
    matter_id: matterId,
    document_type: 'Witness Statement',
    title: `Supplementary Witness Statement (draft) — ${matterName || 'Matter'}`,
    content: text,
    status: 'Draft',
    notes: 'Built from answered fact list prompts only. Draft for review.',
  });
}

export function summarise(summary = {}) {
  const total = Number(summary.total || 0);
  const covered = Number(summary.covered || 0);
  const partly = Number(summary.partly || 0);
  const notCovered = Number(summary.not_covered || 0);
  return { total, covered, partly, notCovered };
}