import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Pencil, X } from 'lucide-react';
import { CONTEXT_TYPES, TAXONOMY, getIssuesForDomain, contextTypeLabel } from '@/lib/taxonomy';

const EMPTY = {
  case_law_id: '',
  context_type: 'other',
  context_domain_id: '',
  context_issue_id: '',
  paragraph_ref: '',
  excerpt: '',
  note: '',
};

export default function CitationEditor({ judgment, citations, caseLaw, onChanged }) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const issues = form.context_domain_id ? getIssuesForDomain(form.context_domain_id) : [];

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.case_law_id) return;
    setIsSaving(true);
    try {
      const payload = {
        case_law_id: form.case_law_id,
        context_type: form.context_type,
        context_domain_id: form.context_domain_id,
        context_issue_id: form.context_issue_id,
        paragraph_ref: form.paragraph_ref.trim(),
        excerpt: form.excerpt.trim(),
        note: form.note.trim(),
      };
      if (editingId) {
        await base44.entities.JudgmentCitation.update(editingId, payload);
      } else {
        await base44.entities.JudgmentCitation.create({ ...payload, judgment_id: judgment.id });
      }
      reset();
      onChanged();
    } catch (error) {
      alert(`Could not save the citation: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (citation) => {
    setEditingId(citation.id);
    setForm({
      case_law_id: citation.case_law_id || '',
      context_type: citation.context_type || 'other',
      context_domain_id: citation.context_domain_id || '',
      context_issue_id: citation.context_issue_id || '',
      paragraph_ref: citation.paragraph_ref || '',
      excerpt: citation.excerpt || '',
      note: citation.note || '',
    });
  };

  const handleDelete = async (id) => {
    await base44.entities.JudgmentCitation.delete(id);
    if (editingId === id) reset();
    onChanged();
  };

  const caseLawName = (id) => caseLaw.find((record) => record.id === id)?.name || 'Unknown authority';

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Citations in this judgment ({citations.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {citations.length === 0 ? (
          <p className="text-sm text-slate-500">No citations recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {citations.map((citation) => (
              <div key={citation.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{caseLawName(citation.case_law_id)}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline">{contextTypeLabel(citation.context_type)}</Badge>
                      {citation.paragraph_ref && (
                        <Badge variant="secondary">{citation.paragraph_ref}</Badge>
                      )}
                    </div>
                    {citation.note && <p className="text-sm text-slate-600 mt-2">{citation.note}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(citation)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(citation.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              {editingId ? 'Edit citation' : 'Add a citation'}
            </h4>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="h-4 w-4 mr-1" />
                Cancel edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Authority</Label>
              <Select value={form.case_law_id} onValueChange={(value) => update('case_law_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select authority..." />
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
              <Label>Domain (optional)</Label>
              <Select
                value={form.context_domain_id || 'none'}
                onValueChange={(value) => {
                  update('context_domain_id', value === 'none' ? '' : value);
                  update('context_issue_id', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TAXONOMY.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name}
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
              <Label>Paragraph reference</Label>
              <Input
                value={form.paragraph_ref}
                placeholder="para 42 / [42]"
                onChange={(e) => update('paragraph_ref', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Excerpt</Label>
            <Textarea rows={2} value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} />
          </div>

          <div>
            <Label>Note</Label>
            <Input value={form.note} onChange={(e) => update('note', e.target.value)} />
          </div>

          <Button onClick={handleSave} disabled={isSaving || !form.case_law_id} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : editingId ? 'Update citation' : 'Add citation'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}