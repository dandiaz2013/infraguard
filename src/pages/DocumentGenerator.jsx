import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Download, Eye, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import ExtractCheckPanel from '@/components/authorities/ExtractCheckPanel';
import RecordSweepPanel from '@/components/argument/RecordSweepPanel';
import SourceMaterialPanel from '@/components/documents/SourceMaterialPanel';
import DraftCitationCheck from '@/components/documents/DraftCitationCheck';
import DraftList from '@/components/documents/DraftList';
import { buildRecord } from '@/lib/recordIndex';
import { buildSweeps } from '@/lib/recordFirst';
import { defaultSourceSelection, toRecordDoc, verifyDraftCitations } from '@/lib/caseFile';

export default function DocumentGenerator() {
  const [selectedMatter, setSelectedMatter] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [briefingNotes, setBriefingNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loadedArgument, setLoadedArgument] = useState(null);

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

  const { data: mainAuthorities = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const { data: authorityExtracts = [] } = useQuery({
    queryKey: ['authorityExtracts'],
    queryFn: () => base44.entities.AuthorityExtract.list('-added_date'),
  });

  // The record is read from the Case File Library only. Generated drafts never are.
  const { data: caseFileDocs = [] } = useQuery({
    queryKey: ['caseFileDocuments', selectedMatter],
    queryFn: async () => {
      const page = await base44.entities.CaseFileDocument.filter(
        { matter_id: selectedMatter },
        { sort: '-created_date', limit: 100 }
      );
      return page.items || [];
    },
    enabled: !!selectedMatter
  });

  const [ticked, setTicked] = useState({});
  const [tickedFor, setTickedFor] = useState('');

  React.useEffect(() => {
    if (!selectedMatter || selectedMatter === tickedFor || caseFileDocs.length === 0) return;
    const next = {};
    defaultSourceSelection(caseFileDocs).forEach((row) => {
      next[row.id] = row.reason;
    });
    setTicked(next);
    setTickedFor(selectedMatter);
  }, [caseFileDocs, selectedMatter, tickedFor]);

  const toggleSource = (id) => {
    setTicked((previous) => {
      const next = { ...previous };
      if (next[id]) delete next[id];
      else next[id] = 'Chosen by you';
      return next;
    });
  };

  const mainAuthorityPool = mainAuthorities.filter((record) => record.is_main === true);

  const record = React.useMemo(
    () =>
      buildRecord(
        caseFileDocs.filter((document) => ticked[document.id]).map(toRecordDoc)
      ),
    [caseFileDocs, ticked]
  );

  const citations = React.useMemo(
    () => verifyDraftCitations(generatedContent, record),
    [generatedContent, record]
  );

  const sweeps = React.useMemo(() => buildSweeps(record, []), [record]);

  const { data: latestArgument } = useQuery({
    queryKey: ['latest-argument', selectedMatter],
    queryFn: async () => {
      const args = await base44.entities.Argument.filter(
        { matter_id: selectedMatter },
        '-version_number',
        1
      );
      return args[0];
    },
    enabled: !!selectedMatter,
    onSuccess: (data) => {
      if (data) {
        setLoadedArgument(data);
      }
    }
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
      const response = await base44.functions.invoke('legalDocumentDraft', {
        documentType,
        briefingNotes,
        argument: loadedArgument ? {
          version_number: loadedArgument.version_number,
          argument_title: loadedArgument.argument_title,
          position: loadedArgument.position,
          court: loadedArgument.court,
          fact_pattern: loadedArgument.fact_pattern,
          argument_text: loadedArgument.argument_text
        } : null,
        authorities: authorities.map(a => ({
          title: a.title,
          citation: a.citation,
          legal_principle: a.legal_principle,
          relevance: a.relevance
        })),
        record_documents: record.documents.map((doc) => ({
          name: doc.name,
          role: doc.role,
          record_status: doc.record_status,
          filed_date: doc.filed_date || '',
          provisions: doc.law_items.map((item) => `${item.label} (${item.ref})`)
        })),
        record_findings: sweeps.court_found.slice(0, 20).map((row) => ({
          document_name: row.document_name,
          ref: row.ref,
          quote: row.quote
        })),
        source_material: caseFileDocs
          .filter((document) => ticked[document.id])
          .map((document) => ({
            name: document.file_name,
            category: document.category,
            party: document.party || '',
            date: document.document_date || '',
            reason: ticked[document.id]
          })),
        main_authorities: mainAuthorityPool.map((record) => ({
          name: record.name,
          citation: record.neutral_citation || '',
          court: record.court || '',
          year: record.year || null,
          official_url: record.official_url || record.url || '',
          checked: record.check_status === 'Extract checked against official text',
          extracts: authorityExtracts
            .filter((extract) => extract.case_law_id === record.id)
            .map((extract) => ({
              paragraph_ref: extract.paragraph_ref,
              extract_text: extract.extract_text,
              proposition: extract.proposition || '',
              status: extract.status || '',
            })),
        }))
      });

      setGeneratedContent(response.data.content);
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
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Document Generator</h1>
            <p className="text-slate-600">Generate professional UK legal documents with AI assistance</p>
          </div>
          <Link
            to="/CaseFileLibrary"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
          >
            <FolderOpen className="h-4 w-4" />
            Open Case File Library
          </Link>
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

              {loadedArgument && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-900 font-medium mb-2">
                    ✓ Loaded Argument v{loadedArgument.version_number}: {loadedArgument.argument_title}
                  </p>
                  <p className="text-xs text-green-800">
                    Position: {loadedArgument.position} | Court: {loadedArgument.court}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="briefing">Briefing Notes *</Label>
                <Textarea
                  id="briefing"
                  placeholder="Provide detailed instructions, facts, and specific points to include in the document. The saved argument will be automatically incorporated."
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

        {selectedMatter && (
          <div className="mt-6 space-y-6">
            <SourceMaterialPanel documents={caseFileDocs} ticked={ticked} onToggle={toggleSource} />
            <DraftList matterId={selectedMatter} />
          </div>
        )}

        {generatedContent && (
          <div className="mt-6 space-y-6">
            <DraftCitationCheck rows={citations} />
            <ExtractCheckPanel
              text={generatedContent}
              extracts={authorityExtracts.filter((extract) =>
                mainAuthorityPool.some((record) => record.id === extract.case_law_id)
              )}
              mainAuthorities={mainAuthorityPool}
            />
          </div>
        )}

        {selectedMatter && record.documents.length > 0 && (
          <div className="mt-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-slate-700" />
                  The record used for this document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-slate-500">
                  {record.documents.length} case file document
                  {record.documents.length === 1 ? '' : 's'} chosen for this draft. A statement by the other side is
                  labelled as stated by that party, never as established fact.
                </p>
                <RecordSweepPanel sweeps={sweeps} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}