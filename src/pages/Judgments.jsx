import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import JudgmentFormDialog from '@/components/judgments/JudgmentFormDialog';
import ParseReviewTable from '@/components/judgments/ParseReviewTable';
import CitationEditor from '@/components/judgments/CitationEditor';

const STATUS_STYLES = {
  unparsed: 'bg-slate-100 text-slate-700 border-slate-200',
  parsed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

export default function Judgments() {
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();

  const { data: judgments = [], isLoading } = useQuery({
    queryKey: ['judgments'],
    queryFn: () => base44.entities.Judgment.list('-created_date'),
  });

  const { data: caseLaw = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const { data: citations = [], refetch: refetchCitations } = useQuery({
    queryKey: ['judgmentCitations', selectedId],
    queryFn: () => base44.entities.JudgmentCitation.filter({ judgment_id: selectedId }),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Judgment.create(data),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['judgments'] });
      setFormOpen(false);
      setSelectedId(record.id);
    },
  });

  const selected = judgments.find((judgment) => judgment.id === selectedId) || null;

  const refreshJudgments = () => queryClient.invalidateQueries({ queryKey: ['judgments'] });

  const handleParse = async (judgmentId) => {
    setIsParsing(true);
    setCandidates(null);
    try {
      const response = await base44.functions.invoke('parseJudgment', { judgment_id: judgmentId });
      setCandidates(response.data.candidates || []);
      if ((response.data.candidates || []).length === 0) {
        alert('No citations were found in this judgment text.');
      }
    } catch (error) {
      alert(error?.response?.data?.error || 'Could not parse this judgment.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async (rows) => {
    setIsConfirming(true);
    try {
      const response = await base44.functions.invoke('parseJudgment', {
        judgment_id: selectedId,
        candidates: rows,
      });
      setCandidates(null);
      refreshJudgments();
      refetchCitations();
      alert(response.data.log);
    } catch (error) {
      alert(error?.response?.data?.error || 'Could not save these citations.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Judgments</h1>
            <p className="text-slate-600">
              Paste judgment text, extract its citations with the rule-based parser, then check each one.
            </p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="h-4 w-4 mr-2" />
            Add judgment
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : judgments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No judgments saved yet.</p>
                </CardContent>
              </Card>
            ) : (
              judgments.map((judgment) => (
                <Card
                  key={judgment.id}
                  className={`shadow-sm cursor-pointer transition-colors ${
                    selectedId === judgment.id ? 'border-l-4 border-l-slate-900' : ''
                  }`}
                  onClick={() => {
                    setSelectedId(judgment.id);
                    setCandidates(null);
                  }}
                >
                  <CardContent className="p-4">
                    <p className="font-semibold text-slate-900">{judgment.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge className={STATUS_STYLES[judgment.parse_status] || STATUS_STYLES.unparsed}>
                        {judgment.parse_status || 'unparsed'}
                      </Badge>
                      {judgment.court && <span className="text-xs text-slate-500">{judgment.court}</span>}
                      {judgment.raw_text ? (
                        <span className="text-xs text-slate-400">text saved</span>
                      ) : (
                        <span className="text-xs text-amber-600">no text</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {!selected ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a judgment</h3>
                  <p className="text-slate-600">
                    Choose a judgment on the left to parse its citations and record how each one was used.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="shadow-sm">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{selected.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge className={STATUS_STYLES[selected.parse_status] || STATUS_STYLES.unparsed}>
                            {selected.parse_status || 'unparsed'}
                          </Badge>
                          {selected.court && <Badge variant="outline">{selected.court}</Badge>}
                          {selected.judgment_date && (
                            <Badge variant="outline">{selected.judgment_date}</Badge>
                          )}
                          {selected.source_url && (
                            <a
                              href={selected.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Source
                            </a>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleParse(selected.id)}
                        disabled={isParsing || candidates !== null}
                      >
                        {isParsing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Parse
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selected.raw_text ? (
                      <p className="text-sm text-slate-500">
                        {selected.raw_text.length.toLocaleString()} characters of text saved.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700">
                        This judgment has no text yet. Paste the judgment text before parsing.
                      </p>
                    )}
                    {selected.parse_log && (
                      <p className="text-sm text-slate-600 mt-2">{selected.parse_log}</p>
                    )}
                  </CardContent>
                </Card>

                {candidates !== null && (
                  <ParseReviewTable
                    candidates={candidates}
                    onCancel={() => setCandidates(null)}
                    onConfirm={handleConfirm}
                    isSaving={isConfirming}
                  />
                )}

                <CitationEditor
                  judgment={selected}
                  citations={citations}
                  caseLaw={caseLaw}
                  onChanged={() => {
                    refetchCitations();
                    refreshJudgments();
                  }}
                />
              </>
            )}
          </div>
        </div>

        <JudgmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSave={(data) => createMutation.mutate(data)}
          isSaving={createMutation.isPending}
        />
      </div>
    </div>
  );
}