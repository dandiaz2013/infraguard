import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, Save, Info } from 'lucide-react';
import { TAXONOMY, getDomain, getIssuesForDomain } from '@/lib/taxonomy';
import {
  TRIAGE_QUESTIONS,
  ANSWER_OPTIONS,
  BAND_STYLES,
  computeMerits,
  explainScore,
} from '@/lib/scoring';

export default function TriageTab({ matter, onSaved }) {
  const [domainId, setDomainId] = useState(matter.domain_id || '');
  const [relationshipId, setRelationshipId] = useState(matter.relationship_id || '');
  const [issueIds, setIssueIds] = useState(matter.issue_ids || []);
  const [answers, setAnswers] = useState(matter.answers || {});
  const [breakdown, setBreakdown] = useState(matter.score_breakdown || null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: usages = [] } = useQuery({
    queryKey: ['caseLawUsages', matter.id],
    queryFn: () => base44.entities.CaseLawUsage.filter({ matter_id: matter.id }),
  });

  const { data: caseLaw = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const domain = getDomain(domainId);
  const relationships = domain ? domain.relationships : [];
  const issueGroups = domainId ? getIssuesForDomain(domainId) : [];

  const toggleIssue = (issueId) => {
    setIssueIds((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  const basePayload = () => ({
    domain_id: domainId,
    relationship_id: relationshipId,
    issue_ids: issueIds,
    answers,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await base44.entities.Matter.update(matter.id, basePayload());
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCalculate = async () => {
    setIsSaving(true);
    try {
      const caseLawById = caseLaw.reduce((acc, record) => {
        acc[record.id] = record;
        return acc;
      }, {});
      const result = computeMerits({ answers, usages, caseLawById });
      setBreakdown(result);
      await base44.entities.Matter.update(matter.id, {
        ...basePayload(),
        merits_score: result.total,
        merits_band: result.band,
        score_breakdown: result,
        scored_at: new Date().toISOString(),
      });
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  const band = breakdown?.band || matter.merits_band;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Domain</Label>
              <Select
                value={domainId || 'none'}
                onValueChange={(value) => {
                  const next = value === 'none' ? '' : value;
                  setDomainId(next);
                  setRelationshipId('');
                  setIssueIds([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a domain..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TAXONOMY.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Relationship</Label>
              <Select
                value={relationshipId || 'none'}
                onValueChange={(value) => setRelationshipId(value === 'none' ? '' : value)}
                disabled={relationships.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a relationship..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {relationships.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {issueGroups.length > 0 && (
            <div>
              <Label>Issues</Label>
              <div className="mt-2 space-y-4">
                {issueGroups.map((group) => (
                  <div key={group.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      {group.name}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.issues.map((issue) => (
                        <label
                          key={issue.id}
                          className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
                        >
                          <Checkbox
                            checked={issueIds.includes(issue.id)}
                            onCheckedChange={() => toggleIssue(issue.id)}
                          />
                          {issue.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Triage questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TRIAGE_QUESTIONS.map((question) => (
            <div
              key={question.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm text-slate-800">{question.label}</p>
                <p className="text-xs text-slate-500">Worth {question.points} points</p>
              </div>
              <Select
                value={answers[question.id] || 'Unsure'}
                onValueChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleCalculate} disabled={isSaving}>
              <Calculator className="h-4 w-4 mr-2" />
              {isSaving ? 'Calculating...' : 'Calculate Score'}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              Save selections
            </Button>
          </div>
        </CardContent>
      </Card>

      {breakdown && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Merits breakdown</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">{breakdown.total}</span>
                {band && (
                  <Badge className={BAND_STYLES[band] || 'bg-slate-100 text-slate-700'}>{band}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2">Question</th>
                    <th className="py-2">Answer</th>
                    <th className="py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.questions.map((question) => (
                    <tr key={question.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 text-slate-700">{question.label}</td>
                      <td className="py-2">{question.answer}</td>
                      <td className="py-2 text-right font-mono">
                        {question.points} / {question.max}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b">
                    <td className="py-2 text-slate-700">Triage subtotal</td>
                    <td className="py-2" />
                    <td className="py-2 text-right font-mono">
                      {breakdown.base_score} / {breakdown.max_base_score}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-slate-700">
                      Case law adjustment ({breakdown.case_law.supports} supports,{' '}
                      {breakdown.case_law.against} against)
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {breakdown.case_law.unverified > 0
                        ? `${breakdown.case_law.unverified} unverified ignored`
                        : 'verified authorities only'}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {breakdown.case_law.adjustment > 0 ? '+' : ''}
                      {breakdown.case_law.adjustment}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-slate-900">Total</td>
                    <td className="py-2" />
                    <td className="py-2 text-right font-mono font-semibold">{breakdown.total} / 100</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Why this score</h4>
              <ul className="space-y-1 text-sm text-slate-600 list-disc pl-5">
                {explainScore(breakdown).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <Info className="h-4 w-4 text-amber-700 mt-0.5" />
              <p className="text-sm text-amber-900">Indicative only. Not legal advice.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}