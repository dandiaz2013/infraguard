import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Scale } from 'lucide-react';
import VerifiedBadge from '@/components/caselaw/VerifiedBadge';
import { CONTEXT_TYPES, contextTypeLabel, getIssuesForDomain } from '@/lib/taxonomy';

const EMPTY = { case_law_id: '', context_type: 'other', context_issue_id: '', stance: 'neutral', note: '' };
const STANCE_STYLES = {
  supports: 'bg-green-100 text-green-700 border-green-200',
  against: 'bg-red-100 text-red-700 border-red-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function CaseLawTab({ matter }) {
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  const { data: usages = [], refetch } = useQuery({
    queryKey: ['caseLawUsages', matter.id],
    queryFn: () => base44.entities.CaseLawUsage.filter({ matter_id: matter.id }),
  });

  const { data: caseLaw = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const caseLawById = caseLaw.reduce((acc, record) => {
    acc[record.id] = record;
    return acc;
  }, {});
  const issues = matter.domain_id ? getIssuesForDomain(matter.domain_id) : [];

  const handleAdd = async () => {
    if (!form.case_law_id) return;

    const duplicate = usages.some(
      (usage) =>
        usage.matter_id === matter.id &&
        usage.case_law_id === form.case_law_id &&
        usage.context_type === form.context_type
    );
    if (duplicate) {
      alert('That authority is already linked to this matter for this context type.');
      return;
    }

    setIsSaving(true);
    try {
      await base44.entities.CaseLawUsage.create({
        matter_id: matter.id,
        case_law_id: form.case_law_id,
        context_type: form.context_type,
        context_issue_id: form.context_issue_id,
        stance: form.stance,
        note: form.note.trim(),
      });
      setForm(EMPTY);
      refetch();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await base44.entities.CaseLawUsage.delete(id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Link an authority</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Authority</Label>
              <Select value={form.case_law_id} onValueChange={(value) => update('case_law_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select from the library..." />
                </SelectTrigger>
                <SelectContent>
                  {caseLaw.map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {record.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Context type</Label>
              <Select value={form.context_type} onValueChange={(value) => update('context_type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Issue (optional)</Label>
              <Select
                value={form.context_issue_id || 'none'}
                onValueChange={(value) => update('context_issue_id', value === 'none' ? '' : value)}
                disabled={issues.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {issues.flatMap((group) =>
                    group.issues.map((issue) => (
                      <SelectItem key={issue.id} value={issue.id}>
                        {group.name} - {issue.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Stance</Label>
              <Select value={form.stance} onValueChange={(value) => update('stance', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supports">Supports</SelectItem>
                  <SelectItem value="against">Against</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Input value={form.note} onChange={(e) => update('note', e.target.value)} />
          </div>

          <Button onClick={handleAdd} disabled={isSaving || !form.case_law_id}>
            <Plus className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Link authority'}
          </Button>
        </CardContent>
      </Card>

      {usages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Scale className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No authorities linked to this matter yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {usages.map((usage) => {
            const record = caseLawById[usage.case_law_id];
            const issue = issues
              .flatMap((group) => group.issues)
              .find((item) => item.id === usage.context_issue_id);
            return (
              <Card key={usage.id} className="shadow-sm">
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {record ? record.name : 'Unknown authority'}
                    </p>
                    {record?.neutral_citation && (
                      <p className="text-xs font-mono text-slate-500 mt-1">{record.neutral_citation}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {record && <VerifiedBadge verified={record.verified} />}
                      <Badge variant="outline">{contextTypeLabel(usage.context_type)}</Badge>
                      <Badge className={STANCE_STYLES[usage.stance] || STANCE_STYLES.neutral}>
                        {usage.stance}
                      </Badge>
                      {issue && <Badge variant="secondary">{issue.name}</Badge>}
                    </div>
                    {usage.note && <p className="text-sm text-slate-600 mt-2">{usage.note}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(usage.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}