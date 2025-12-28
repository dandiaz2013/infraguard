import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Download, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function DocumentGenerator() {
  const [selectedMatter, setSelectedMatter] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [briefingNotes, setBriefingNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const queryClient = useQueryClient();

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.filter({ status: 'Active' })
  });

  const { data: authorities = [] } = useQuery({
    queryKey: ['authorities', selectedMatter],
    queryFn: () => base44.entities.LegalAuthority.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents']);
      alert('Document saved successfully!');
    }
  });

  const handleGenerate = async () => {
    if (!documentType || !briefingNotes.trim()) {
      alert('Please select document type and provide briefing notes');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');
    setShowPreview(false);

    try {
      const authoritiesContext = authorities.length > 0 
        ? `\n\nRelevant Legal Authorities:\n${authorities.map(a => 
            `- ${a.title} (${a.citation})\n  Legal Principle: ${a.legal_principle}\n  Relevance: ${a.relevance}`
          ).join('\n\n')}`
        : '';

      const documentPrompts = {
        'Particulars of Claim': `Draft comprehensive Particulars of Claim following CPR rules for UK civil litigation. Include proper headings, numbered paragraphs, clear statement of facts, legal basis for claim, and prayer for relief.`,
        'Defence': `Draft a robust Defence document following CPR rules. Include proper admissions, denials with reasons, counterclaim if applicable, and clear legal arguments.`,
        'Witness Statement': `Draft a formal Witness Statement complying with CPR Part 32 and Practice Direction 32. Include proper heading, statement of truth, chronological narrative, and exhibits references.`,
        'Skeleton Argument': `Draft a persuasive Skeleton Argument for court submission. Include concise statement of issues, legal propositions with authorities, and structured submissions.`,
        'Appeal Grounds': `Draft comprehensive Grounds of Appeal. Include clear identification of errors, legal basis for appeal, and authorities supporting each ground.`,
        'Case Summary': `Draft a detailed Case Summary covering factual background, legal issues, authorities, and case analysis.`,
        'Legal Opinion': `Draft a formal Legal Opinion with clear structure: instructions, facts, issues, legal analysis, authorities, and advice.`
      };

      const prompt = `${documentPrompts[documentType] || 'Draft a professional legal document.'}

Briefing Notes:
${briefingNotes}
${authoritiesContext}

Requirements:
- Use formal UK legal language and formatting
- Include proper citations in UK format
- Structure with clear headings and numbered paragraphs
- Be comprehensive and professionally drafted
- Include statement of truth where appropriate
- Format in markdown with proper hierarchy

Generate the complete ${documentType}:`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      setGeneratedContent(response);
      setShowPreview(true);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Document generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedContent || !selectedMatter) {
      alert('Please select a matter and generate content first');
      return;
    }

    saveMutation.mutate({
      matter_id: selectedMatter,
      document_type: documentType,
      title: documentTitle || `${documentType} - ${new Date().toLocaleDateString()}`,
      content: generatedContent,
      status: 'Draft'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Document Generator</h1>
          <p className="text-slate-600">Generate professional UK legal documents with AI assistance</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="shadow-md border-l-4 border-l-green-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Document Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="matter">Matter *</Label>
                <Select value={selectedMatter} onValueChange={setSelectedMatter}>
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
                <Label htmlFor="docType">Document Type *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Particulars of Claim">Particulars of Claim</SelectItem>
                    <SelectItem value="Defence">Defence</SelectItem>
                    <SelectItem value="Witness Statement">Witness Statement</SelectItem>
                    <SelectItem value="Skeleton Argument">Skeleton Argument</SelectItem>
                    <SelectItem value="Appeal Grounds">Appeal Grounds</SelectItem>
                    <SelectItem value="Case Summary">Case Summary</SelectItem>
                    <SelectItem value="Legal Opinion">Legal Opinion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  placeholder="Optional custom title"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="briefing">Briefing Notes *</Label>
                <Textarea
                  id="briefing"
                  placeholder="Provide detailed instructions, facts, and specific points to include in the document. The more detail you provide, the better the generated document will be."
                  value={briefingNotes}
                  onChange={(e) => setBriefingNotes(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {selectedMatter && authorities.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900 font-medium">
                    ✓ {authorities.length} legal {authorities.length === 1 ? 'authority' : 'authorities'} will be included
                  </p>
                </div>
              )}

              <Button 
                onClick={handleGenerate}
                disabled={isGenerating || !documentType || !briefingNotes.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Document...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-2" />
                    Generate Document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Document Preview
                </CardTitle>
                {generatedContent && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleSave}>
                      <Download className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!showPreview ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p>Configure and generate a document to see preview</p>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none bg-white p-6 rounded-lg border">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}