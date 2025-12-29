import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, AlertCircle, CheckCircle2, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function JudgmentAnalyzer() {
  const [judgmentText, setJudgmentText] = useState('');
  const [judgmentFile, setJudgmentFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setJudgmentFile(file);
    
    try {
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
        setJudgmentText(extractResult.output.full_text);
      }
    } catch (error) {
      console.error('File processing error:', error);
      alert('Failed to process file. Please paste text directly.');
    }
  };

  const handleAnalyze = async () => {
    if (!judgmentText.trim()) {
      alert('Please provide judgment text or upload a file');
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a UK legal expert analyzing a court judgment. Perform comprehensive analysis of the following judgment text:

${judgmentText}

Please provide detailed analysis including:

1. CASE INFORMATION
   - Case name and citation
   - Court and judges
   - Date of judgment
   - Parties involved

2. FACTUAL BACKGROUND
   - Key facts in chronological order
   - Procedural history
   - Previous decisions (if any)

3. LEGAL ISSUES
   - Identify all legal issues/questions before the court
   - Area of law for each issue

4. CLAIMANT'S ARGUMENTS
   - Main legal arguments presented by claimant
   - Authorities cited by claimant
   - Propositions advanced

5. DEFENDANT'S ARGUMENTS
   - Main legal arguments presented by defendant
   - Authorities cited by defendant
   - Counter-arguments and defenses

6. COURT'S REASONING
   - How the court analyzed each issue
   - Legal principles applied
   - Interpretation of authorities
   - Key quotes from the judgment

7. HOLDING AND OUTCOME
   - Court's decision on each issue
   - Final judgment/order
   - Remedies granted

8. CITED AUTHORITIES
   - List all case law cited
   - For each: case name, citation, how it was applied
   - Identify if properly applied or misapplied

9. LEGAL PRINCIPLES ESTABLISHED
   - Key legal principles from this case
   - Tests or standards articulated
   - Precedential value

10. EXECUTIVE SUMMARY
    - 3-4 paragraph summary of the entire judgment
    - Key takeaways
    - Significance

Verify all cited authorities for accuracy and proper application. Flag any concerning citations.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            case_information: {
              type: "object",
              properties: {
                case_name: { type: "string" },
                citation: { type: "string" },
                court: { type: "string" },
                judges: { type: "array", items: { type: "string" } },
                date: { type: "string" },
                parties: { type: "object" }
              }
            },
            factual_background: {
              type: "object",
              properties: {
                key_facts: { type: "array", items: { type: "string" } },
                procedural_history: { type: "string" },
                previous_decisions: { type: "string" }
              }
            },
            legal_issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issue: { type: "string" },
                  area_of_law: { type: "string" }
                }
              }
            },
            claimant_arguments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  argument: { type: "string" },
                  authorities_cited: { type: "array", items: { type: "string" } },
                  propositions: { type: "array", items: { type: "string" } }
                }
              }
            },
            defendant_arguments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  argument: { type: "string" },
                  authorities_cited: { type: "array", items: { type: "string" } },
                  defenses: { type: "array", items: { type: "string" } }
                }
              }
            },
            court_reasoning: {
              type: "object",
              properties: {
                analysis: { type: "string" },
                principles_applied: { type: "array", items: { type: "string" } },
                key_quotes: { type: "array", items: { type: "string" } }
              }
            },
            holding: {
              type: "object",
              properties: {
                decision: { type: "string" },
                final_order: { type: "string" },
                remedies: { type: "array", items: { type: "string" } }
              }
            },
            cited_authorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  case_name: { type: "string" },
                  citation: { type: "string" },
                  how_applied: { type: "string" },
                  properly_applied: { type: "boolean" },
                  concerns: { type: "string" }
                }
              }
            },
            legal_principles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  principle: { type: "string" },
                  explanation: { type: "string" },
                  precedential_value: { type: "string" }
                }
              }
            },
            executive_summary: { type: "string" }
          }
        }
      });

      setAnalysis(result);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Judgment Analyzer</h1>
          <p className="text-slate-600">AI-powered analysis of court judgments with citation verification</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="shadow-md border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Judgment Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file">Upload Judgment (PDF or Text)</Label>
                <div className="mt-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              <div className="text-center text-sm text-slate-500">OR</div>

              <div>
                <Label htmlFor="text">Paste Judgment Text</Label>
                <Textarea
                  id="text"
                  placeholder="Paste the full judgment text here..."
                  value={judgmentText}
                  onChange={(e) => setJudgmentText(e.target.value)}
                  rows={18}
                  className="font-mono text-sm"
                />
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !judgmentText.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing Judgment...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5 mr-2" />
                    Analyze Judgment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          <Card className="shadow-md lg:col-span-1">
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[800px] overflow-y-auto">
              {!analysis && !isAnalyzing && (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p>Upload or paste a judgment to begin analysis</p>
                </div>
              )}

              {analysis && (
                <div className="space-y-6">
                  {/* Executive Summary */}
                  {analysis.executive_summary && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <h3 className="font-semibold text-blue-900 mb-2">Executive Summary</h3>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysis.executive_summary}</p>
                    </div>
                  )}

                  {/* Case Information */}
                  {analysis.case_information && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Case Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Case:</span> {analysis.case_information.case_name}</p>
                        <p><span className="font-medium">Citation:</span> {analysis.case_information.citation}</p>
                        <p><span className="font-medium">Court:</span> {analysis.case_information.court}</p>
                        {analysis.case_information.date && (
                          <p><span className="font-medium">Date:</span> {analysis.case_information.date}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legal Issues */}
                  {analysis.legal_issues?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Legal Issues</h3>
                      <div className="space-y-3">
                        {analysis.legal_issues.map((issue, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 rounded">
                            <p className="text-sm font-medium text-slate-900">{issue.issue}</p>
                            <Badge variant="outline" className="mt-2">{issue.area_of_law}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arguments */}
                  <div className="grid grid-cols-2 gap-4">
                    {analysis.claimant_arguments?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Claimant Arguments</h3>
                        <div className="space-y-2">
                          {analysis.claimant_arguments.slice(0, 3).map((arg, idx) => (
                            <div key={idx} className="text-xs bg-green-50 p-2 rounded">
                              {arg.argument}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.defendant_arguments?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Defendant Arguments</h3>
                        <div className="space-y-2">
                          {analysis.defendant_arguments.slice(0, 3).map((arg, idx) => (
                            <div key={idx} className="text-xs bg-red-50 p-2 rounded">
                              {arg.argument}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cited Authorities with Verification */}
                  {analysis.cited_authorities?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Cited Authorities (Verified)</h3>
                      <div className="space-y-3">
                        {analysis.cited_authorities.map((auth, idx) => (
                          <div key={idx} className={`p-3 rounded border-l-4 ${
                            auth.properly_applied 
                              ? 'bg-green-50 border-green-500' 
                              : 'bg-red-50 border-red-500'
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{auth.case_name}</p>
                                <p className="text-xs text-slate-600 font-mono mt-1">{auth.citation}</p>
                              </div>
                              {auth.properly_applied ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-2">{auth.how_applied}</p>
                            {auth.concerns && (
                              <p className="text-xs text-red-700 mt-2 font-medium">⚠️ {auth.concerns}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legal Principles */}
                  {analysis.legal_principles?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Legal Principles Established</h3>
                      <div className="space-y-3">
                        {analysis.legal_principles.map((principle, idx) => (
                          <div key={idx} className="bg-purple-50 p-3 rounded">
                            <p className="text-sm font-medium text-slate-900">{principle.principle}</p>
                            <p className="text-xs text-slate-600 mt-2">{principle.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Court's Holding */}
                  {analysis.holding && (
                    <div className="bg-slate-900 text-white p-4 rounded">
                      <h3 className="font-semibold mb-2">Court's Decision</h3>
                      <p className="text-sm">{analysis.holding.decision}</p>
                      {analysis.holding.final_order && (
                        <p className="text-sm mt-2 opacity-90">{analysis.holding.final_order}</p>
                      )}
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