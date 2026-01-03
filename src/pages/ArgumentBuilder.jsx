import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Scale, Loader2, Plus, Sparkles, Upload, X, FileText, CheckCircle } from 'lucide-react';
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
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCorrectingFacts, setIsCorrectingFacts] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentArgumentVersion, setCurrentArgumentVersion] = useState(null);
  const [isLoadingLastVersion, setIsLoadingLastVersion] = useState(false);

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

  // Load last saved argument version when matter changes
  React.useEffect(() => {
    if (selectedMatter) {
      loadLastArgumentVersion();
    }
  }, [selectedMatter]);

  // Auto-populate fact pattern when matter changes (if no saved version)
  React.useEffect(() => {
    if (currentMatter && !currentArgumentVersion) {
      setFactPattern(currentMatter.description || '');
    }
  }, [currentMatter, currentArgumentVersion]);

  // Detect unsaved changes
  React.useEffect(() => {
    if (generatedArgument) {
      setHasUnsavedChanges(true);
    }
  }, [generatedArgument]);

  // Block navigation on unsaved changes
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved legal work. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadLastArgumentVersion = async () => {
    if (!selectedMatter) return;

    setIsLoadingLastVersion(true);
    try {
      const arguments = await base44.entities.Argument.filter(
        { matter_id: selectedMatter },
        '-version_number',
        1
      );

      if (arguments.length > 0) {
        const lastVersion = arguments[0];
        setCurrentArgumentVersion(lastVersion);
        setFactPattern(lastVersion.fact_pattern || '');
        setPosition(lastVersion.position);
        
        if (lastVersion.fact_expansions) {
          setChronology(lastVersion.fact_expansions.chronology || '');
          setDisputedFacts(lastVersion.fact_expansions.disputed_facts || '');
          setUndisputedFacts(lastVersion.fact_expansions.undisputed_facts || '');
          setLegalIssuesRaised(lastVersion.fact_expansions.legal_issues_raised || '');
          setProceduralHistory(lastVersion.fact_expansions.procedural_history || '');
          setLossHarmRisk(lastVersion.fact_expansions.loss_harm_risk || '');
        }

        if (lastVersion.argument_text) {
          setGeneratedArgument({ full_argument_markdown: lastVersion.argument_text });
        }

        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Failed to load last version:', error);
    } finally {
      setIsLoadingLastVersion(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedDocs = [];
      
      for (const file of files) {
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        
        const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: uploadResult.file_url,
          json_schema: {
            type: "object",
            properties: {
              full_text: { type: "string" }
            }
          }
        });

        if (extractResult.status === 'success' && extractResult.output?.full_text) {
          uploadedDocs.push({
            name: file.name,
            url: uploadResult.file_url,
            content: extractResult.output.full_text
          });
        }
      }

      setUploadedDocuments([...uploadedDocuments, ...uploadedDocs]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  const removeDocument = (index) => {
    setUploadedDocuments(uploadedDocuments.filter((_, i) => i !== index));
  };

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

    if (!currentMatter?.court) {
      alert('ERROR: Matter must have a Court specified. Please update Matter details.');
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

      const documentsContext = uploadedDocuments.length > 0
        ? `\n\n## Uploaded Documents\n${uploadedDocuments.map((doc, idx) => 
            `### Document ${idx + 1}: ${doc.name}\n${doc.content.substring(0, 3000)}`
          ).join('\n\n')}`
        : '';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are JurisAI, a UK legal reasoning assistant. Draft a structured court-ready legal argument for ${position}.

## CRITICAL: COURT & JURISDICTION LOCKED
**Court:** ${currentMatter.court}
**Matter Type:** ${currentMatter?.matter_type || 'N/A'}
**Matter:** ${currentMatter?.matter_name || ''}

YOU MUST:
- Address ONLY ${currentMatter.court} - DO NOT change court level
- Apply practice directions for ${currentMatter.court}
- Use authorities binding on ${currentMatter.court}
- Use procedural language appropriate to ${currentMatter.court}

## Core Fact Pattern (Auto-Populated from Matter)
${factPattern}

${expandedFacts ? `## Fact Pattern Expansion (User-Provided Detail)\n${expandedFacts}` : ''}
${issueContext}
${authoritiesContext}
${documentsContext}

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

  const handleCorrectFacts = async () => {
    if (!generatedArgument) {
      alert('Generate an argument first');
      return;
    }

    setIsCorrectingFacts(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a UK legal fact-checker. Review the following legal argument and identify any factual inaccuracies, unsupported claims, or errors in legal reasoning.

## Generated Argument
${generatedArgument.full_argument_markdown}

## Original Facts
${factPattern}

## Task
1. Identify any factual errors or unsupported claims
2. Check if legal principles are correctly stated
3. Verify case citations if any
4. Flag any logical inconsistencies
5. Provide corrected version if errors found

Return the corrected argument with all factual errors fixed. If no errors, return the original argument with a note that it's accurate.`,
        add_context_from_internet: true
      });

      setGeneratedArgument({ full_argument_markdown: result });
      alert('Facts reviewed and corrected');
    } catch (error) {
      console.error('Correction error:', error);
      alert('Failed to correct facts');
    } finally {
      setIsCorrectingFacts(false);
    }
  };

  const handleSave = async () => {
    if (!generatedArgument || !selectedMatter || !currentMatter) {
      alert('Please generate an argument first');
      return;
    }

    const firstLine = generatedArgument.full_argument_markdown?.split('\n')[0] || 'Legal Argument';
    const nextVersion = currentArgumentVersion ? currentArgumentVersion.version_number + 1 : 1;

    try {
      await base44.entities.Argument.create({
        matter_id: selectedMatter,
        version_number: nextVersion,
        argument_title: firstLine.replace(/^#+ /, '').substring(0, 100),
        position: position,
        court: currentMatter.court,
        jurisdiction: 'UK',
        fact_pattern: factPattern,
        fact_expansions: {
          chronology,
          disputed_facts: disputedFacts,
          undisputed_facts: undisputedFacts,
          legal_issues_raised: legalIssuesRaised,
          procedural_history: proceduralHistory,
          loss_harm_risk: lossHarmRisk
        },
        argument_text: generatedArgument.full_argument_markdown,
        authorities: authorities.map(a => a.id),
        status: 'Draft',
        parent_version_id: currentArgumentVersion?.id
      });

      setHasUnsavedChanges(false);
      queryClient.invalidateQueries(['arguments']);
      await loadLastArgumentVersion();
      alert(`Argument saved as Version ${nextVersion}`);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save argument');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">⚖️ JurisAI Argument Builder</h1>
          <p className="text-slate-600">Versioned legal arguments with court-level enforcement</p>
          {isLoadingLastVersion && (
            <p className="text-xs text-blue-600 mt-2">Loading last saved version...</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="shadow-md border-l-4 border-l-blue-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-blue-600" />
                  Argument Configuration
                  {currentArgumentVersion && (
                    <Badge variant="outline" className="ml-2">
                      v{currentArgumentVersion.version_number}
                    </Badge>
                  )}
                </CardTitle>
                {hasUnsavedChanges && (
                  <Badge variant="destructive" className="animate-pulse">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
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
                    {currentMatter.court ? (
                      <p className="bg-amber-100 border border-amber-300 rounded px-2 py-1">
                        <span className="font-bold">🔒 Court (LOCKED):</span> {currentMatter.court}
                      </p>
                    ) : (
                      <p className="bg-red-100 border border-red-300 rounded px-2 py-1 text-red-900">
                        ⚠️ Court NOT SET - Update Matter first
                      </p>
                    )}
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

              <div>
                <Label htmlFor="documents">📎 Upload Documents (Optional)</Label>
                <div className="mt-2 space-y-2">
                  <input
                    id="documents"
                    type="file"
                    multiple
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {isUploading && (
                    <p className="text-xs text-slate-500">Uploading and processing...</p>
                  )}
                  {uploadedDocuments.length > 0 && (
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-700" />
                            <span className="text-xs text-green-900">{doc.name}</span>
                          </div>
                          <button onClick={() => removeDocument(idx)} className="text-green-700 hover:text-green-900">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCorrectFacts} disabled={isCorrectingFacts}>
                      {isCorrectingFacts ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Correct Facts
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      <Plus className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
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