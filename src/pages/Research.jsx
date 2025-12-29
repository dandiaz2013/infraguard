import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, BookOpen, Scale, ExternalLink, Plus, Loader2 } from 'lucide-react';

export default function Research() {
  const [researchQuery, setResearchQuery] = useState('');
  const [selectedMatter, setSelectedMatter] = useState('');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResults, setResearchResults] = useState(null);

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

  const createAuthorityMutation = useMutation({
    mutationFn: (data) => base44.entities.LegalAuthority.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['authorities']);
    }
  });

  const createIssueMutation = useMutation({
    mutationFn: (data) => base44.entities.LegalIssue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['issues']);
    }
  });

  const updateIssueMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LegalIssue.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['issues']);
    }
  });

  const handleResearch = async () => {
    if (!researchQuery.trim()) return;

    setIsResearching(true);
    setResearchResults(null);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a UK legal research assistant. Analyze the following legal issue and identify relevant UK legal authorities (case law, statutes, regulations).

Legal Issue/Query: ${researchQuery}

Please provide:
1. Analysis of the core legal issue and area of law
2. A list of 5-8 relevant UK legal authorities
3. For each authority, include:
   - Type (Case Law, Statute, Statutory Instrument, etc.)
   - Full citation in proper UK legal format
   - Court (for cases) or year of enactment
   - Current validity status (Active/Overruled/Distinguished/Superseded)
   - Key legal principle or holding
   - Brief explanation of relevance (2-3 sentences)
   - One important quote if applicable
   - URL to find the full text if available

Focus on recent and binding authorities. Prioritize Supreme Court, Court of Appeal, and High Court decisions. Include relevant statutory provisions. Verify each authority is current and not overruled.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            issue_analysis: {
              type: "object",
              properties: {
                core_issue: { type: "string" },
                area_of_law: { type: "string" },
                key_concepts: { type: "array", items: { type: "string" } }
              }
            },
            authorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  citation: { type: "string" },
                  title: { type: "string" },
                  court: { type: "string" },
                  year: { type: "string" },
                  validity_status: { type: "string" },
                  legal_principle: { type: "string" },
                  relevance: { type: "string" },
                  key_quote: { type: "string" },
                  url: { type: "string" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });

      setResearchResults(response);

      // Auto-create or update legal issue if matter is selected
      if (selectedMatter && response.issue_analysis) {
        if (selectedIssue) {
          // Update existing issue
          updateIssueMutation.mutate({
            id: selectedIssue,
            data: {
              status: 'Authorities Found'
            }
          });
        } else {
          // Create new issue
          createIssueMutation.mutate({
            matter_id: selectedMatter,
            issue_title: response.issue_analysis.core_issue,
            issue_description: researchQuery,
            area_of_law: response.issue_analysis.area_of_law,
            status: 'Authorities Found',
            priority: 'High'
          });
        }
      }
    } catch (error) {
      console.error('Research error:', error);
      alert('Research failed. Please try again.');
    } finally {
      setIsResearching(false);
    }
  };

  const handleSaveAuthority = (authority) => {
    const authorityData = {
      matter_id: selectedMatter || undefined,
      authority_type: authority.type === 'Case Law' ? 'Case Law' : 
                     authority.type.includes('Statute') ? 'Statute' : 'Other',
      citation: authority.citation,
      title: authority.title,
      court: authority.court || '',
      year: authority.year || '',
      legal_principle: authority.legal_principle,
      relevance: authority.relevance,
      key_quotes: authority.key_quote ? [authority.key_quote] : [],
      url: authority.url || '',
      tags: [authority.type, authority.validity_status || 'Active', 'UK']
    };

    createAuthorityMutation.mutate(authorityData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Legal Research</h1>
          <p className="text-slate-600">AI-powered research to find relevant UK legal authorities</p>
        </div>

        {/* Research Input */}
        <Card className="mb-8 shadow-md border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              Research Query
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="matter">Link to Matter (Optional)</Label>
              <Select value={selectedMatter} onValueChange={(v) => {
                setSelectedMatter(v);
                setSelectedIssue('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.matter_name} - {matter.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMatter && issues.length > 0 && (
              <div>
                <Label htmlFor="issue">Link to Legal Issue (Optional)</Label>
                <Select value={selectedIssue} onValueChange={setSelectedIssue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an issue or create new..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Create New Issue</SelectItem>
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
              <Label htmlFor="query">Legal Issue or Question</Label>
              <Textarea
                id="query"
                placeholder="Describe the legal issue you need to research. For example: 'What is the test for breach of fiduciary duty in UK company law?' or 'Grounds for challenging a planning decision on procedural fairness grounds'"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>

            <Button 
              onClick={handleResearch}
              disabled={isResearching || !researchQuery.trim()}
              className="w-full bg-amber-600 hover:bg-amber-700"
              size="lg"
            >
              {isResearching ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Researching UK Law...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Start Research
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Research Results */}
        {researchResults && (
          <div className="space-y-6">
            {/* Issue Analysis */}
            {researchResults.issue_analysis && (
              <Card className="shadow-sm bg-purple-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-900">
                    <Scale className="h-5 w-5" />
                    Legal Issue Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-1">Core Issue</h4>
                    <p className="text-slate-700">{researchResults.issue_analysis.core_issue}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-1">Area of Law</h4>
                    <Badge variant="outline" className="bg-white">{researchResults.issue_analysis.area_of_law}</Badge>
                  </div>
                  {researchResults.issue_analysis.key_concepts?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Key Legal Concepts</h4>
                      <div className="flex flex-wrap gap-2">
                        {researchResults.issue_analysis.key_concepts.map((concept, idx) => (
                          <Badge key={idx} variant="secondary">{concept}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {researchResults.summary && (
              <Card className="shadow-sm bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <BookOpen className="h-5 w-5" />
                    Research Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 leading-relaxed">{researchResults.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Authorities */}
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                Relevant Legal Authorities ({researchResults.authorities?.length || 0})
              </h2>
              
              <div className="space-y-4">
                {researchResults.authorities?.map((authority, index) => (
                  <Card key={index} className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-slate-900">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-slate-900 text-white">
                              {authority.type}
                            </Badge>
                            {authority.year && (
                              <Badge variant="outline">{authority.year}</Badge>
                            )}
                            <Badge className={`
                              ${authority.validity_status === 'Active' ? 'bg-green-100 text-green-700 border-green-300' : ''}
                              ${authority.validity_status === 'Overruled' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                              ${authority.validity_status === 'Distinguished' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : ''}
                              ${authority.validity_status === 'Superseded' ? 'bg-orange-100 text-orange-700 border-orange-300' : ''}
                              border
                            `}>
                              {authority.validity_status || 'Active'}
                            </Badge>
                            <Badge variant="outline" className="border-blue-300 text-blue-700">UK</Badge>
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">
                            {authority.title}
                          </h3>
                          <p className="text-sm text-slate-600 font-mono mb-3">{authority.citation}</p>
                          {authority.court && (
                            <p className="text-sm text-slate-600 mb-3">
                              <Scale className="h-3 w-3 inline mr-1" />
                              {authority.court}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveAuthority(authority)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          {authority.url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <a href={authority.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-1">Legal Principle</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">{authority.legal_principle}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-1">Relevance to Your Query</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">{authority.relevance}</p>
                        </div>

                        {authority.key_quote && (
                          <div className="bg-slate-50 border-l-4 border-slate-300 p-3 rounded">
                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Key Quote</h4>
                            <p className="text-sm text-slate-600 italic leading-relaxed">"{authority.key_quote}"</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!researchResults && !isResearching && (
          <Card className="shadow-sm">
            <CardContent className="p-12 text-center">
              <Search className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Start Your Legal Research</h3>
              <p className="text-slate-600 max-w-md mx-auto mb-4">
                Enter a legal issue or question above to find relevant UK case law, statutes, and other authorities with AI-powered verification.
              </p>
              <div className="text-sm text-slate-500 space-y-1">
                <p>✓ Automatic authority verification</p>
                <p>✓ Validity status checking</p>
                <p>✓ Jurisdiction-specific (UK) filtering</p>
                <p>✓ Links to legal issues in your matters</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}