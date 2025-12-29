import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Scale, Loader2, Plus, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ArgumentBuilder() {
  const [selectedMatter, setSelectedMatter] = useState('');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [factPattern, setFactPattern] = useState('');
  const [position, setPosition] = useState('Claimant');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArgument, setGeneratedArgument] = useState(null);

  const queryClient = useQueryClient();

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.filter({ status: 'Active' })
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', selectedMatter],
    queryFn: () => base44.entities.LegalIssue.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const { data: authorities = [] } = useQuery({
    queryKey: ['authorities', selectedMatter],
    queryFn: () => base44.entities.LegalAuthority.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const saveArgumentMutation = useMutation({
    mutationFn: (data) => base44.entities.Argument.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['arguments']);
      alert('Argument saved successfully!');
    }
  });

  const handleGenerate = async () => {
    if (!factPattern.trim() || !selectedMatter) {
      alert('Please select a matter and provide facts');
      return;
    }

    setIsGenerating(true);
    setGeneratedArgument(null);

    try {
      const authoritiesContext = authorities.length > 0
        ? `\n\nRelevant Legal Authorities:\n${authorities.map(a => 
            `- ${a.title} (${a.citation})\n  Principle: ${a.legal_principle}\n  Status: ${a.tags?.find(t => ['Active', 'Overruled'].includes(t)) || 'Active'}`
          ).join('\n\n')}`
        : '';

      const issueContext = selectedIssue && issues.length > 0
        ? `\n\nLegal Issue: ${issues.find(i => i.id === selectedIssue)?.issue_title || ''}`
        : '';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a UK legal expert drafting a comprehensive legal argument for ${position}.

Facts:
${factPattern}
${issueContext}
${authoritiesContext}

Draft a detailed, persuasive legal argument including:

1. STATEMENT OF ISSUES
   - Clear identification of legal questions

2. LEGAL FRAMEWORK
   - Relevant statutes, regulations, and legal principles
   - Applicable tests and standards

3. DETAILED ARGUMENT
   - Step-by-step legal analysis
   - Application of authorities to facts
   - Proper citation format (UK style)
   - Address each element/requirement
   
4. PROPOSITIONS
   - Clear legal propositions
   - Supporting authorities for each

5. FACTUAL APPLICATION
   - How the law applies to these specific facts
   - Distinguish unfavorable authorities
   - Strengthen favorable authorities

6. COUNTER-ARGUMENTS
   - Anticipate opposing arguments
   - Provide rebuttals

7. CONCLUSION
   - Summary of argument
   - Relief/remedy sought

Use formal UK legal language. Cite all authorities properly. Be thorough and persuasive.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            issues: { type: "array", items: { type: "string" } },
            legal_framework: { type: "string" },
            detailed_argument: { type: "string" },
            propositions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  proposition: { type: "string" },
                  supporting_authorities: { type: "array", items: { type: "string" } }
                }
              }
            },
            counter_arguments: { type: "string" },
            conclusion: { type: "string" },
            full_argument_markdown: { type: "string" }
          }
        }
      });

      setGeneratedArgument(result);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Argument generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedArgument || !selectedMatter) {
      alert('Please generate an argument first');
      return;
    }

    saveArgumentMutation.mutate({
      matter_id: selectedMatter,
      issue_id: selectedIssue || undefined,
      argument_title: generatedArgument.issues?.[0] || 'Legal Argument',
      position: position,
      proposition: generatedArgument.propositions?.[0]?.proposition || '',
      reasoning: generatedArgument.detailed_argument || '',
      counter_arguments: generatedArgument.counter_arguments || '',
      authorities: authorities.map(a => a.id),
      order_index: 1
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Argument Builder</h1>
          <p className="text-slate-600">Generate comprehensive legal arguments with AI analysis</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="shadow-md border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                Argument Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="matter">Matter *</Label>
                <Select value={selectedMatter} onValueChange={(v) => {
                  setSelectedMatter(v);
                  setSelectedIssue('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select matter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {matters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.matter_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMatter && issues.length > 0 && (
                <div>
                  <Label htmlFor="issue">Legal Issue (Optional)</Label>
                  <Select value={selectedIssue} onValueChange={setSelectedIssue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {issues.map((issue) => (
                        <SelectItem key={issue.id} value={issue.id}>
                          {issue.issue_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="position">Position *</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Claimant">Claimant</SelectItem>
                    <SelectItem value="Defendant">Defendant</SelectItem>
                    <SelectItem value="Appellant">Appellant</SelectItem>
                    <SelectItem value="Respondent">Respondent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="facts">Fact Pattern *</Label>
                <Textarea
                  id="facts"
                  placeholder="Describe the key facts, issues, and legal questions. Include relevant dates, parties, and circumstances. The more detail you provide, the stronger the argument."
                  value={factPattern}
                  onChange={(e) => setFactPattern(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {selectedMatter && authorities.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-900 font-medium">
                    ✓ {authorities.length} legal {authorities.length === 1 ? 'authority' : 'authorities'} will be incorporated
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !factPattern.trim() || !selectedMatter}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Argument...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Argument
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Generated Argument</CardTitle>
                {generatedArgument && (
                  <Button size="sm" onClick={handleSave}>
                    <Plus className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="max-h-[800px] overflow-y-auto">
              {!generatedArgument && !isGenerating && (
                <div className="text-center py-12 text-slate-500">
                  <Scale className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p>Configure and generate to see argument</p>
                </div>
              )}

              {generatedArgument && (
                <div className="space-y-4">
                  <div className="prose prose-slate max-w-none bg-white p-6 rounded-lg border">
                    <ReactMarkdown>{generatedArgument.full_argument_markdown}</ReactMarkdown>
                  </div>

                  {generatedArgument.propositions?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Key Propositions</h3>
                      <div className="space-y-3">
                        {generatedArgument.propositions.map((prop, idx) => (
                          <div key={idx} className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm font-medium text-slate-900 mb-2">{prop.proposition}</p>
                            {prop.supporting_authorities?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {prop.supporting_authorities.map((auth, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{auth}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}