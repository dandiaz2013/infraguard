import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ListChecks, Gavel } from 'lucide-react';
import WorkflowProgress from '@/components/workflow/WorkflowProgress';
import StepUpload from '@/components/workflow/StepUpload';
import StepSimpleArguments from '@/components/workflow/StepSimpleArguments';
import StepLibrary from '@/components/workflow/StepLibrary';
import StepVerify from '@/components/workflow/StepVerify';
import StepArgument from '@/components/workflow/StepArgument';

const STEPS = [
  { key: 'upload', label: 'Upload', description: 'Bundle the case documents' },
  { key: 'arguments', label: 'Simple arguments', description: 'Issues and both sides, plain English' },
  { key: 'library', label: 'Build library', description: 'Extract authorities from the bundle' },
  { key: 'verify', label: 'Verify', description: 'Check each authority on the source' },
  { key: 'draft', label: 'Argument builder', description: 'Draft, check and save a version' },
];

export default function CaseWorkflow() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialId = urlParams.get('matter') || urlParams.get('matter_id') || urlParams.get('id') || '';
  const [matterId, setMatterId] = useState(initialId);
  const [stepIndex, setStepIndex] = useState(null);

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.list(),
  });

  const matterQuery = useQuery({
    queryKey: ['matter', matterId],
    queryFn: async () => {
      const records = await base44.entities.Matter.filter({ id: matterId });
      return records[0];
    },
    enabled: !!matterId,
  });

  const filesQuery = useQuery({
    queryKey: ['matterFiles', matterId],
    queryFn: () => base44.entities.MatterFile.filter({ matter_id: matterId }),
    enabled: !!matterId,
  });

  const usagesQuery = useQuery({
    queryKey: ['caseLawUsages', matterId],
    queryFn: () => base44.entities.CaseLawUsage.filter({ matter_id: matterId }),
    enabled: !!matterId,
  });

  const caseLawQuery = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
    enabled: !!matterId,
  });

  const argumentsQuery = useQuery({
    queryKey: ['arguments', matterId],
    queryFn: () => base44.entities.Argument.filter({ matter_id: matterId }),
    enabled: !!matterId,
  });

  const refreshAll = async () => {
    await Promise.all([
      matterQuery.refetch(),
      filesQuery.refetch(),
      usagesQuery.refetch(),
      caseLawQuery.refetch(),
      argumentsQuery.refetch(),
    ]);
  };

  const matter = matterQuery.data;
  const files = filesQuery.data || [];
  const usages = usagesQuery.data || [];
  const caseLaw = caseLawQuery.data || [];
  const legalArguments = argumentsQuery.data || [];

  const caseLawById = caseLaw.reduce((acc, record) => {
    acc[record.id] = record;
    return acc;
  }, {});

  const authorities = [];
  const seenIds = new Set();
  usages.forEach((usage) => {
    const record = caseLawById[usage.case_law_id];
    if (record && !seenIds.has(record.id)) {
      seenIds.add(record.id);
      authorities.push(record);
    }
  });

  const simpleArgs = matter?.simple_arguments;
  const hasSimpleArgs = Array.isArray(simpleArgs?.issues) && simpleArgs.issues.length > 0;
  const unverifiedCount = authorities.filter((record) => record.verified !== true).length;
  const hasWorkflowArgument = legalArguments.some((item) =>
    (item.argument_title || '').startsWith('Case Workflow')
  );

  const done = [
    files.length > 0,
    hasSimpleArgs,
    authorities.length > 0,
    authorities.length > 0 && unverifiedCount === 0,
    hasWorkflowArgument,
  ];

  const firstIncomplete = done.findIndex((value) => !value);
  const activeIndex = stepIndex ?? (firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete);

  if (!matterId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Case Workflow</h1>
          <p className="text-slate-600 mb-6">
            Choose a matter to work through the five steps: upload, simple arguments, library, verify, draft.
          </p>

          {matters.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-600">
                No matters yet.{' '}
                <Link to={createPageUrl('Matters')} className="underline">
                  Create one first
                </Link>
                .
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {matters.map((item) => (
                <Card key={item.id} className="shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.matter_name}</p>
                      <p className="text-xs text-slate-500">
                        {item.client_name} &middot; {item.matter_type}
                        {item.court ? ` · ${item.court}` : ''}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setMatterId(item.id)} className="bg-slate-900 hover:bg-slate-800">
                      <ListChecks className="h-4 w-4 mr-2" />
                      Open workflow
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (matterQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Matter not found</h2>
          <Link to={createPageUrl('Matters')}>
            <Button variant="outline">Back to Matters</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to={createPageUrl('MatterDetail') + '?id=' + matter.id}>
            <Button variant="ghost" className="mb-3">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to matter
            </Button>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Case Workflow</h1>
              <p className="text-slate-600 mt-1">{matter.matter_name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {matter.matter_reference && (
                  <span className="text-xs font-mono text-slate-600">{matter.matter_reference}</span>
                )}
                <Badge variant="outline">{matter.matter_type}</Badge>
                {matter.court && <Badge variant="secondary">{matter.court}</Badge>}
                <Badge className="bg-slate-100 text-slate-700 border-slate-200 gap-1">
                  <Gavel className="h-3 w-3" />
                  {authorities.length} authorities
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-sm mb-6">
          <CardContent className="p-5">
            <WorkflowProgress
              steps={STEPS}
              done={done}
              activeIndex={activeIndex}
              onSelect={setStepIndex}
            />
          </CardContent>
        </Card>

        {activeIndex === 0 && <StepUpload matter={matter} files={files} onChanged={refreshAll} />}

        {activeIndex === 1 && (
          <StepSimpleArguments matter={matter} files={files} onChanged={refreshAll} />
        )}

        {activeIndex === 2 && (
          <StepLibrary
            matter={matter}
            files={files}
            authorities={authorities}
            onChanged={refreshAll}
          />
        )}

        {activeIndex === 3 && (
          <StepVerify matter={matter} authorities={authorities} onChanged={refreshAll} />
        )}

        {activeIndex === 4 && (
          <StepArgument
            matter={matter}
            authorities={authorities}
            arguments={legalArguments}
            onSaved={refreshAll}
          />
        )}
      </div>
    </div>
  );
}