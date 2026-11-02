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
      const uploadResult = await base44.integrations.Core.UploadPrivateFile({ file });

      const extractResponse = await base44.functions.invoke('documentTextExtract', {
        fileUri: uploadResult.file_uri
      });

      if (extractResponse.data?.text) {
        setJudgmentText(extractResponse.data.text);
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
      const response = await base44.functions.invoke('judgmentAnalysis', {
        judgmentText
      });

      setAnalysis(response.data.analysis);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">⚖️ JurisAI Judgment Analyzer</h1>
          <p className="text-slate-600">Critical analysis for errors, appeal grounds, and litigation strategy</p>
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
                    <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
                      <h3 className="font-bold text-red-900 mb-2">⚠️ CRITICAL ANALYSIS SUMMARY</h3>
                      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{analysis.executive_summary}</div>
                    </div>
                  )}

                  {/* Case Information */}
                  {analysis.case_information && (
                    <div className="bg-slate-100 p-4 rounded">
                      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Case Information
                      </h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Case:</span> {analysis.case_information.case_name}</p>
                        <p><span className="font-medium">Citation:</span> {analysis.case_information.citation}</p>
                        <p><span className="font-medium">Court:</span> {analysis.case_information.court}</p>
                        <p><span className="font-medium">Date:</span> {analysis.case_information.date}</p>
                      </div>
                    </div>
                  )}

                  {/* Issues Decided vs Not Decided */}
                  <div className="grid grid-cols-2 gap-4">
                    {analysis.issues_decided?.length > 0 && (
                      <div className="bg-green-50 border border-green-200 p-4 rounded">
                        <h3 className="font-semibold text-green-900 mb-3 text-sm">✓ Issues Decided</h3>
                        <ul className="space-y-2 text-xs">
                          {analysis.issues_decided.map((issue, idx) => (
                            <li key={idx} className="text-green-800">• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.issues_not_decided?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded">
                        <h3 className="font-semibold text-red-900 mb-3 text-sm">✗ Issues NOT Decided</h3>
                        <ul className="space-y-2 text-xs">
                          {analysis.issues_not_decided.map((issue, idx) => (
                            <li key={idx} className="text-red-800 font-medium">• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Clear Points to Raise - MOST IMPORTANT */}
                  {analysis.clear_points_to_raise?.length > 0 && (
                    <div className="bg-amber-50 border-2 border-amber-500 p-5 rounded">
                      <h3 className="font-bold text-amber-900 mb-4 text-lg">📋 CLEAR POINTS TO RAISE</h3>
                      <div className="space-y-4">
                        {analysis.clear_points_to_raise.map((point, idx) => (
                          <div key={idx} className="bg-white p-4 rounded border-l-4 border-amber-600">
                            <div className="flex items-start gap-3">
                              <Badge className="bg-amber-600 text-white flex-shrink-0">Point {point.point_number}</Badge>
                              <div className="flex-1 space-y-2">
                                <p className="font-semibold text-slate-900">{point.specific_error}</p>
                                <p className="text-sm text-slate-700"><span className="font-medium">Why it matters:</span> {point.why_it_matters}</p>
                                <p className="text-sm text-blue-700"><span className="font-medium">Remedy:</span> {point.remedy_sought}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Errors of Law */}
                  {analysis.errors_of_law?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-900 mb-3">🚨 ERRORS OF LAW (Appeal Grounds)</h3>
                      <div className="space-y-3">
                        {analysis.errors_of_law.map((error, idx) => (
                          <div key={idx} className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-bold text-red-900">ERROR: {error.error}</p>
                              <Badge className={
                                error.strength === 'Strong' ? 'bg-red-600' :
                                error.strength === 'Moderate' ? 'bg-orange-500' : 'bg-yellow-500'
                              }>{error.strength}</Badge>
                            </div>
                            <p className="text-sm text-slate-700 mt-2"><span className="font-medium">Correct position:</span> {error.correct_position}</p>
                            <p className="text-sm text-slate-700 mt-2"><span className="font-medium">Authority:</span> {error.supporting_authority}</p>
                            <p className="text-sm text-red-800 mt-2"><span className="font-medium">Impact:</span> {error.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Errors of Fact */}
                  {analysis.errors_of_fact?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-3">⚠️ ERRORS OF FACT</h3>
                      <div className="space-y-2">
                        {analysis.errors_of_fact.map((error, idx) => (
                          <div key={idx} className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                            <p className="text-sm font-medium text-orange-900">{error.finding}</p>
                            <p className="text-xs text-slate-700 mt-1"><span className="font-medium">Problem:</span> {error.problem}</p>
                            <p className="text-xs text-slate-700 mt-1"><span className="font-medium">Evidence:</span> {error.evidence_issue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Procedural Irregularities */}
                  {analysis.procedural_irregularities?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-purple-900 mb-3">⚖️ PROCEDURAL IRREGULARITIES</h3>
                      <div className="space-y-2">
                        {analysis.procedural_irregularities.map((irreg, idx) => (
                          <div key={idx} className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
                            <p className="text-sm font-medium text-purple-900">{irreg.irregularity}</p>
                            <p className="text-xs text-slate-700 mt-1"><span className="font-medium">Rule breached:</span> {irreg.rule_breached}</p>
                            <p className="text-xs text-slate-700 mt-1"><span className="font-medium">Impact:</span> {irreg.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Misapplied Authorities */}
                  {analysis.misapplied_authorities?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-900 mb-3">❌ AUTHORITIES MISAPPLIED</h3>
                      <div className="space-y-3">
                        {analysis.misapplied_authorities.map((auth, idx) => (
                          <div key={idx} className="bg-red-50 border border-red-200 p-3 rounded">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-1" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-red-900">{auth.case_name}</p>
                                <p className="text-xs text-slate-600 font-mono mt-1">{auth.citation}</p>
                                <p className="text-xs text-slate-700 mt-2"><span className="font-medium">Misapplication:</span> {auth.how_misapplied}</p>
                                <p className="text-xs text-green-700 mt-1"><span className="font-medium">Correct application:</span> {auth.correct_application}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Counter Authorities Ignored */}
                  {analysis.counter_authorities_ignored?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-3">📚 AUTHORITIES THE COURT IGNORED</h3>
                      <div className="space-y-3">
                        {analysis.counter_authorities_ignored.map((auth, idx) => (
                          <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                            <p className="text-sm font-medium text-blue-900">{auth.case_name}</p>
                            <p className="text-xs text-slate-600 font-mono mt-1">{auth.citation}</p>
                            <p className="text-xs text-slate-700 mt-2"><span className="font-medium">Why relevant:</span> {auth.why_relevant}</p>
                            <p className="text-xs text-blue-800 mt-1"><span className="font-medium">Impact:</span> {auth.impact_if_considered}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reasoning Weaknesses */}
                  {analysis.reasoning_weaknesses?.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-300 p-4 rounded">
                      <h3 className="font-semibold text-yellow-900 mb-3">💭 REASONING WEAKNESSES</h3>
                      <ul className="space-y-2 text-sm">
                        {analysis.reasoning_weaknesses.map((weakness, idx) => (
                          <li key={idx} className="text-slate-800">• {weakness}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Strategic Recommendations */}
                  {analysis.strategic_recommendations && (
                    <div className="bg-slate-900 text-white p-5 rounded">
                      <h3 className="font-bold mb-4 text-lg">🎯 STRATEGIC RECOMMENDATIONS</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="font-semibold text-amber-400">Should Appeal?</p>
                          <p className="mt-1">{analysis.strategic_recommendations.should_appeal}</p>
                        </div>
                        {analysis.strategic_recommendations.best_grounds?.length > 0 && (
                          <div>
                            <p className="font-semibold text-amber-400">Best Appeal Grounds (Ranked):</p>
                            <ol className="mt-1 space-y-1 list-decimal list-inside">
                              {analysis.strategic_recommendations.best_grounds.map((ground, idx) => (
                                <li key={idx}>{ground}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {analysis.strategic_recommendations.alternative_remedies?.length > 0 && (
                          <div>
                            <p className="font-semibold text-amber-400">Alternative Remedies:</p>
                            <ul className="mt-1 space-y-1">
                              {analysis.strategic_recommendations.alternative_remedies.map((remedy, idx) => (
                                <li key={idx}>• {remedy}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-amber-400">Risk Assessment:</p>
                          <p className="mt-1">{analysis.strategic_recommendations.risk_assessment}</p>
                        </div>
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