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
  const [isResearching, setIsResearching] = useState(false);
  const [researchResults, setResearchResults] = useState(null);

  const queryClient = useQueryClient();

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.filter({ status: 'Active' })
  });

  const createAuthorityMutation = useMutation({
    mutationFn: (data) => base44.entities.LegalAuthority.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['authorities']);
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
1. A list of 5-8 relevant UK legal authorities
2. For each authority, include:
   - Type (Case Law, Statute, Statutory Instrument, etc.)
   - Full citation in proper UK legal format
   - Court (for cases) or year of enactment
   - Key legal principle or holding
   - Brief explanation of relevance (2-3 sentences)
   - One important quote if applicable

Focus on recent and binding authorities. Prioritize Supreme Court, Court of Appeal, and High Court decisions. Include relevant statutory provisions.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
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
                  legal_principle: { type: "string" },
                  relevance: { type: "string" },
                  key_quote: { type: "string" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });

      setResearchResults(response);
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
      tags: [authority.type]
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
              <Select value={selectedMatter} onValueChange={setSelectedMatter}>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveAuthority(authority)}
                          className="ml-4"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Save
                        </Button>
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
              <p className="text-slate-600 max-w-md mx-auto">
                Enter a legal issue or question above to find relevant UK case law, statutes, and other authorities.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}