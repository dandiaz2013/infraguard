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
  const [chronology, setChronology] = useState('');
  const [disputedFacts, setDisputedFacts] = useState('');
  const [undisputedFacts, setUndisputedFacts] = useState('');
  const [legalIssuesRaised, setLegalIssuesRaised] = useState('');
  const [proceduralHistory, setProceduralHistory] = useState('');
  const [lossHarmRisk, setLossHarmRisk] = useState('');
  const [position, setPosition] = useState('Claimant');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArgument, setGeneratedArgument] = useState(null);

  const queryClient = useQueryClient();

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.filter({ status: 'Active' })
  });

  const { data: currentMatter } = useQuery({
    queryKey: ['matter', selectedMatter],
    queryFn: async () => {
      const matters = await base44.entities.Matter.filter({ id: selectedMatter });
      return matters[0];
    },
    enabled: !!selectedMatter
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

  // Auto-populate fact pattern when matter changes
  React.useEffect(() => {
    if (currentMatter) {
      setFactPattern(currentMatter.description || '');
    }
  }, [currentMatter]);

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

      const expandedFacts = `
${chronology ? `\n### Chronology (Key Events):\n${chronology}` : ''}
${disputedFacts ? `\n### Disputed Facts:\n${disputedFacts}` : ''}
${undisputedFacts ? `\n### Undisputed Facts:\n${undisputedFacts}` : ''}
${legalIssuesRaised ? `\n### Legal Issues Raised:\n${legalIssuesRaised}` : ''}
${proceduralHistory ? `\n### Procedural History:\n${proceduralHistory}` : ''}
${lossHarmRisk ? `\n### Loss, Harm, or Risk:\n${lossHarmRisk}` : ''}
      `.trim();

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are JurisAI, a UK legal reasoning assistant. Draft a structured court-ready legal argument for ${position}.

## Matter Context
**Matter:** ${currentMatter?.matter_name || ''}
**Court:** ${currentMatter?.court || 'N/A'}
**Matter Type:** ${currentMatter?.matter_type || 'N/A'}

## Core Fact Pattern (Auto-Populated from Matter)
${factPattern}

${expandedFacts ? `## Fact Pattern Expansion (User-Provided Detail)\n${expandedFacts}` : ''}
${issueContext}
${authoritiesContext}

## Instructions to AI
When generating arguments:
- Treat auto-populated Matter facts as accurate unless contradicted
- Prioritise user-added expansions
- Identify legally material facts
- Ignore emotional language unless legally relevant
- Structure arguments clearly with headings and sub-points
- Where appropriate, flag factual gaps or evidential weaknesses

## Output Requirements
Generate a professional, court-ready legal argument with:

1. **STATEMENT OF ISSUES**
   - Clear identification of legal questions

2. **LEGAL FRAMEWORK**
   - Relevant statutes and legal principles
   - Applicable tests and standards

3. **FACTUAL MATRIX**
   - Key material facts
   - Timeline if relevant

4. **DETAILED ARGUMENT**
   - Step-by-step legal analysis
   - Application of authorities to facts
   - Proper UK citation format
   - Address each element/requirement

5. **COUNTER-ARGUMENTS & REBUTTAL**
   - Anticipate opposing arguments
   - Provide clear rebuttals

6. **CONCLUSION & RELIEF SOUGHT**
   - Summary of argument
   - Remedies requested

Use formal UK legal language. Cite all authorities properly. Be thorough and persuasive.`,
        add_context_from_internet: true
      });

      setGeneratedArgument({ full_argument_markdown: result });
    } catch (error) {
      console.error('Generation error:', error);
      alert(`Argument generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedArgument || !selectedMatter) {
      alert('Please generate an argument first');
      return;
    }

    const firstLine = generatedArgument.full_argument_markdown?.split('\n')[0] || 'Legal Argument';

    saveArgumentMutation.mutate({
      matter_id: selectedMatter,
      issue_id: selectedIssue || undefined,
      argument_title: firstLine.replace(/^#+ /, '').substring(0, 100),
      position: position,
      proposition: generatedArgument.full_argument_markdown?.substring(0, 500) || '',
      reasoning: generatedArgument.full_argument_markdown || '',
      counter_arguments: '',
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
            <CardContent className="space-y-4 max-h-[750px] overflow-y-auto">
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

              {currentMatter && (
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">📋 Matter Overview (Read Only)</h3>
                  <div className="text-xs text-slate-700 space-y-1">
                    <p><span className="font-medium">Matter:</span> {currentMatter.matter_name}</p>
                    <p><span className="font-medium">Client:</span> {currentMatter.client_name}</p>
                    {currentMatter.court && <p><span className="font-medium">Court:</span> {currentMatter.court}</p>}
                    <p><span className="font-medium">Type:</span> {currentMatter.matter_type}</p>
                    <p><span className="font-medium">Status:</span> {currentMatter.status}</p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="facts">Core Fact Pattern (Auto-Populated) *</Label>
                <Textarea
                  id="facts"
                  placeholder="This auto-populates from Matter. Edit as needed."
                  value={factPattern}
                  onChange={(e) => setFactPattern(e.target.value)}
                  rows={5}
                  className="text-sm bg-slate-50"
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">📝 Fact Pattern Expansion (Optional)</h3>
                
                <div>
                  <Label htmlFor="chronology" className="text-xs">Chronology (Key Events)</Label>
                  <Textarea
                    id="chronology"
                    placeholder="- Event 1&#10;- Event 2"
                    value={chronology}
                    onChange={(e) => setChronology(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="disputed" className="text-xs">Disputed Facts</Label>
                  <Textarea
                    id="disputed"
                    placeholder="Facts contested by parties..."
                    value={disputedFacts}
                    onChange={(e) => setDisputedFacts(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="undisputed" className="text-xs">Undisputed Facts</Label>
                  <Textarea
                    id="undisputed"
                    placeholder="Facts agreed by all parties..."
                    value={undisputedFacts}
                    onChange={(e) => setUndisputedFacts(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="legal_issues" className="text-xs">Legal Issues Raised</Label>
                  <Textarea
                    id="legal_issues"
                    placeholder="Key legal questions..."
                    value={legalIssuesRaised}
                    onChange={(e) => setLegalIssuesRaised(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="procedural" className="text-xs">Procedural History</Label>
                  <Textarea
                    id="procedural"
                    placeholder="Previous hearings, orders..."
                    value={proceduralHistory}
                    onChange={(e) => setProceduralHistory(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="loss" className="text-xs">Loss, Harm, or Risk</Label>
                  <Textarea
                    id="loss"
                    placeholder="Damages, injury, harm..."
                    value={lossHarmRisk}
                    onChange={(e) => setLossHarmRisk(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
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

              {generatedArgument && generatedArgument.full_argument_markdown && (
                <div className="prose prose-slate max-w-none bg-white p-6 rounded-lg border overflow-y-auto max-h-[700px]">
                  <ReactMarkdown>{generatedArgument.full_argument_markdown}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}