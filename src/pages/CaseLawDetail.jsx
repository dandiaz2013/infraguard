import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, ShieldCheck, BookOpen, Briefcase } from 'lucide-react';
import VerifiedBadge from '@/components/caselaw/VerifiedBadge';
import CaseLawFormDialog from '@/components/caselaw/CaseLawFormDialog';
import { contextTypeLabel } from '@/lib/taxonomy';

export default function CaseLawDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const caseLawId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: record, isLoading } = useQuery({
    queryKey: ['caseLaw', caseLawId],
    queryFn: async () => {
      const matches = await base44.entities.CaseLaw.filter({ id: caseLawId });
      return matches[0];
    },
    enabled: !!caseLawId,
  });

  const { data: citations = [] } = useQuery({
    queryKey: ['caseLawCitations', caseLawId],
    queryFn: () => base44.entities.JudgmentCitation.filter({ case_law_id: caseLawId }),
    enabled: !!caseLawId,
  });

  const { data: usages = [] } = useQuery({
    queryKey: ['caseLawUsageRecords', caseLawId],
    queryFn: () => base44.entities.CaseLawUsage.filter({ case_law_id: caseLawId }),
    enabled: !!caseLawId,
  });

  const judgmentIds = [...new Set(citations.map((citation) => citation.judgment_id))];
  const { data: judgments = [] } = useQuery({
    queryKey: ['caseLawJudgments', judgmentIds.join(',')],
    queryFn: () => base44.entities.Judgment.filter({ id: { $in: judgmentIds } }),
    enabled: judgmentIds.length > 0,
  });

  const matterIds = [...new Set(usages.map((usage) => usage.matter_id))];
  const { data: matters = [] } = useQuery({
    queryKey: ['caseLawMatters', matterIds.join(',')],
    queryFn: () => base44.entities.Matter.filter({ id: { $in: matterIds } }),
    enabled: matterIds.length > 0,
  });

  const saveMutation = async (data) => {
    await base44.entities.CaseLaw.update(record.id, data);
    queryClient.invalidateQueries({ queryKey: ['caseLaw'] });
    queryClient.invalidateQueries({ queryKey: ['caseLaw', caseLawId] });
    setDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Authority not found</h2>
          <Link to={createPageUrl('CaseLawLibrary')}>
            <Button variant="outline">Back to library</Button>
          </Link>
        </div>
      </div>
    );
  }

  const contextCounts = usages.reduce((acc, usage) => {
    acc[usage.context_type] = (acc[usage.context_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to={createPageUrl('CaseLawLibrary')}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to library
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{record.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge verified={record.verified} />
              {record.neutral_citation && (
                <span className="font-mono text-sm text-slate-600">{record.neutral_citation}</span>
              )}
              {record.court && <Badge variant="outline">{record.court}</Badge>}
              {record.year && <Badge variant="outline">{record.year}</Badge>}
              {record.report_reference && (
                <Badge variant="secondary">{record.report_reference}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {record.verified !== true && (
              <Button
                variant="outline"
                onClick={() => saveMutation({ ...record, verified: true })}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Mark verified
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              Edit
            </Button>
            {record.url && (
              <Button asChild>
                <a href={record.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Primary source
                </a>
              </Button>
            )}
          </div>
        </div>

        {record.summary && (
          <Card className="mb-6 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{record.summary}</p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Principles</CardTitle>
          </CardHeader>
          <CardContent>
            {record.principles && record.principles.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {record.principles.map((principle, index) => (
                  <li key={index}>{principle}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No principles recorded yet.</p>
            )}
            {record.source_note && (
              <p className="text-xs text-slate-500 mt-4">Source note: {record.source_note}</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Contexts used</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(contextCounts).length === 0 ? (
              <p className="text-sm text-slate-500">Not linked to any matter yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(contextCounts).map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {contextTypeLabel(type)} {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-500" />
                Cited in judgments ({judgments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {judgments.length === 0 ? (
                <p className="text-sm text-slate-500">Not yet found in a parsed judgment.</p>
              ) : (
                <ul className="space-y-2">
                  {judgments.map((judgment) => (
                    <li key={judgment.id}>
                      <Link
                        to={createPageUrl('Judgments')}
                        className="text-sm text-slate-800 hover:underline"
                      >
                        {judgment.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-slate-500" />
                Used in matters ({matters.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {matters.length === 0 ? (
                <p className="text-sm text-slate-500">Not linked to a matter yet.</p>
              ) : (
                <ul className="space-y-2">
                  {matters.map((matter) => (
                    <li key={matter.id}>
                      <Link
                        to={createPageUrl('MatterDetail') + '?id=' + matter.id}
                        className="text-sm text-slate-800 hover:underline"
                      >
                        {matter.matter_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <CaseLawFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={record}
          onSave={saveMutation}
          isSaving={false}
        />
      </div>
    </div>
  );
}