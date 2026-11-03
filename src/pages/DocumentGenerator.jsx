import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Loader2, Download, Eye, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import ExtractCheckPanel from '@/components/authorities/ExtractCheckPanel';
import RecordSweepPanel from '@/components/argument/RecordSweepPanel';
import SourceMaterialPanel from '@/components/documents/SourceMaterialPanel';
import DraftCitationCheck from '@/components/documents/DraftCitationCheck';
import DraftList from '@/components/documents/DraftList';
import ApplicationContextPanel from '@/components/documents/ApplicationContextPanel';
import ParagraphPackPanel from '@/components/documents/ParagraphPackPanel';
import CounselReview from '@/components/draft/CounselReview';
import { buildRecord } from '@/lib/recordIndex';
import { buildSweeps } from '@/lib/recordFirst';
import { defaultSourceSelection, dedupeDocuments, toRecordDoc } from '@/lib/caseFile';
import { applicationDetails, documentLabels, isVariation } from '@/lib/applicationContext';
import { buildDraftRequest, pickParagraphs, skeletonStructure } from '@/lib/documentPack';
import { checkRows as buildCheckRows, reviewItems } from '@/lib/draftCheck';
import { buildGateway } from '@/lib/gateway';
import { promptnessFor } from '@/lib/promptness';
import { buildRegister } from '@/lib/register';
import { buildSupplementaryStatement } from '@/lib/supplementaryStatement';
import { markUserStatement } from '@/lib/fieldStates';

const CHECKED = 'Extract checked against official text';

export default function DocumentGenerator() {
  const [selectedMatter, setSelectedMatter] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [briefingNotes, setBriefingNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loadedArgument, setLoadedArgument] = useState('');

  const [orderId, setOrderId] = useState('');
  const [applicationSummary, setApplicationSummary] = useState('');
  const [ourSide, setOurSide] = useState('');
  const [court, setCourt] = useState('');
  const [pinned, setPinned] = useState([]);
  const [includeSupplementary, setIncludeSupplementary] = useState(false);
  const [modelReview, setModelReview] = useState([]);
  const [reviewBusy, setReviewBusy] = useState(false);

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

  const { data: issueApproaches = [] } = useQuery({
    queryKey: ['issueApproaches', selectedMatter],
    queryFn: () => base44.entities.IssueApproach.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const { data: legalTests = [] } = useQuery({
    queryKey: ['legalTests', selectedMatter],
    queryFn: () => base44.entities.LegalTest.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const { data: userFields = [] } = useQuery({
    queryKey: ['userFields', selectedMatter],
    queryFn: () => base44.entities.UserField.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const { data: registerAnswers = [] } = useQuery({
    queryKey: ['registerAnswers', selectedMatter],
    queryFn: () => base44.entities.RegisterAnswer.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const { data: gapAnalyses = [] } = useQuery({
    queryKey: ['gapAnalyses', selectedMatter],
    queryFn: () => base44.entities.GapAnalysis.filter({ matter_id: selectedMatter }, '-generated_at', 1),
    enabled: !!selectedMatter
  });

  const [ticked, setTicked] = useState({});
  const [tickedFor, setTickedFor] = useState('');

  // A document uploaded twice (same name and size) is used once.
  const { unique: fileDocs, duplicates } = React.useMemo(() => dedupeDocuments(caseFileDocs), [caseFileDocs]);

  React.useEffect(() => {
    if (!selectedMatter || selectedMatter === tickedFor || fileDocs.length === 0) return;
    const next = {};
    defaultSourceSelection(fileDocs).forEach((row) => {
      next[row.id] = row.reason;
    });
    setTicked(next);
    setTickedFor(selectedMatter);
  }, [fileDocs, selectedMatter, tickedFor]);

  const toggleSource = (id) => {
    setTicked((previous) => {
      const next = { ...previous };
      if (next[id]) delete next[id];
      else next[id] = 'Chosen by you';
      return next;
    });
  };

  const mainAuthorityPool = mainAuthorities.filter((record) => record.is_main === true);
  const matter = matters.find((entry) => entry.id === selectedMatter) || null;

  React.useEffect(() => {
    setOrderId('');
    setApplicationSummary('');
    setPinned([]);
    setOurSide(matter?.our_side || '');
    setCourt(matter?.court || '');
  }, [matter?.id]);

  const tickedDocs = React.useMemo(() => fileDocs.filter((document) => ticked[document.id]), [fileDocs, ticked]);

  const record = React.useMemo(() => buildRecord(tickedDocs.map(toRecordDoc)), [tickedDocs]);

  // What the document is for: the application, the order challenged, our side and the court.
  const details = React.useMemo(
    () =>
      applicationDetails({
        documents: fileDocs.map((document) => ({ ...document, ticked: Boolean(ticked[document.id]) })),
        orderId,
        summary: applicationSummary
      }),
    [fileDocs, ticked, orderId, applicationSummary]
  );

  React.useEffect(() => {
    if (!orderId && details.order) setOrderId(details.order.id);
  }, [details.order, orderId]);

  const variation = React.useMemo(() => isVariation(details), [details]);
  const order = details.order;
  const orderFound = Boolean(order) && Boolean(ticked[order.id]);

  const labels = React.useMemo(() => documentLabels(tickedDocs, order?.id || ''), [tickedDocs, order?.id]);

  const checkedExtracts = React.useMemo(
    () =>
      authorityExtracts
        .filter((extract) => (extract.status || CHECKED) === CHECKED)
        .map((extract) => {
          const authority = mainAuthorities.find((entry) => entry.id === extract.case_law_id);
          return {
            ...extract,
            case_name: authority?.name || '',
            citation: authority?.neutral_citation || '',
          };
        }),
    [authorityExtracts, mainAuthorities]
  );

  const promptness = React.useMemo(
    () => promptnessFor({ record, orderId: order?.id || '', extracts: checkedExtracts }),
    [record, order?.id, checkedExtracts]
  );

  const gateway = React.useMemo(
    () => buildGateway({ record, extracts: checkedExtracts, promptness }),
    [record, checkedExtracts, promptness]
  );

  const savedByIssue = React.useMemo(
    () =>
      (issueApproaches || []).reduce((acc, row) => {
        const current = acc[row.issue_id];
        if (!current || String(row.saved_at || '') > String(current.saved_at || '')) acc[row.issue_id] = row;
        return acc;
      }, {}),
    [issueApproaches]
  );

  const confirmedTests = React.useMemo(
    () =>
      (legalTests || []).filter(
        (test) =>
          test.status === 'Confirmed by user' &&
          test.usage !== 'Background: tests applied in the earlier decision'
      ),
    [legalTests]
  );

  const pack = React.useMemo(
    () =>
      pickParagraphs({
        record,
        gateway,
        ourPoints: loadedArgument?.our_points || [],
        pinned,
      }),
    [record, gateway, loadedArgument, pinned]
  );

  const userStatements = React.useMemo(
    () =>
      (userFields || [])
        .filter((field) => String(field.text || '').trim())
        .map((field) => ({ text: markUserStatement(field.text) })),
    [userFields]
  );

  const register = React.useMemo(() => {
    const answers = (registerAnswers || []).reduce((acc, row) => {
      acc[row.item_id] = row;
      return acc;
    }, {});
    return buildRegister({ record, tests: confirmedTests, answers });
  }, [record, confirmedTests, registerAnswers]);

  const supplementary = React.useMemo(() => {
    if (!includeSupplementary) return '';
    const gap = (gapAnalyses || [])[0];
    return buildSupplementaryStatement({
      factList: gap?.fact_list || [],
      matterName: matter?.matter_name || '',
      court,
    }).text;
  }, [includeSupplementary, gapAnalyses, matter, court]);

  const sweeps = React.useMemo(() => buildSweeps(record, []), [record]);

  const checks = React.useMemo(
    () => (generatedContent ? buildCheckRows(generatedContent, tickedDocs, checkedExtracts) : []),
    [generatedContent, tickedDocs, checkedExtracts]
  );

  const review = React.useMemo(
    () =>
      generatedContent
        ? [...modelReview, ...reviewItems(generatedContent, tickedDocs, checkedExtracts, { variation, order })]
        : [],
    [generatedContent, modelReview, tickedDocs, checkedExtracts, variation, order]
  );

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

  const runCounselReview = async (content) => {
    setReviewBusy(true);
    try {
      const response = await base44.functions.invoke('argumentSections', {
        mode: 'review',
        draft: content,
        court,
        position: ourSide,
        record_paragraphs: pack.paragraphs,
        extracts: checkedExtracts,
      });
      const passages = (response.data?.passages || []).map((passage) => ({
        kind: 'weak',
        passage: passage.passage,
        problem: passage.problem,
        fix: passage.fix,
        section: 'Counsel',
      }));
      setModelReview(passages);
    } catch (error) {
      setModelReview([]);
    } finally {
      setReviewBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!documentType || !briefingNotes.trim()) {
      alert('Please select document type and provide briefing notes');
      return;
    }
    if (!selectedMatter) {
      alert('Please select a matter');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');
    setShowPreview(false);
    setModelReview([]);

    try {
      const request = buildDraftRequest({
        documentType,
        briefingNotes,
        ourSide,
        court,
        application: details,
        order,
        orderFound,
        variation,
        structure: skeletonStructure({ documentType, variation }),
        paragraphs: pack.paragraphs,
        gateway,
        savedByIssue,
        promptness,
        tests: confirmedTests,
        extracts: checkedExtracts,
        registerItems: register.items,
        userStatements,
        supplementary,
        pinned,
        argument: loadedArgument
          ? {
              version_number: loadedArgument.version_number,
              argument_title: loadedArgument.argument_title,
              position: loadedArgument.position,
              court: loadedArgument.court,
              fact_pattern: loadedArgument.fact_pattern,
              argument_text: loadedArgument.argument_text,
            }
          : null,
        recordDocuments: record.documents.map((doc) => ({
          name: doc.name,
          role: doc.role,
          record_status: doc.record_status,
          filed_date: doc.filed_date || '',
        })),
        mainAuthorities: mainAuthorityPool.map((authority) => ({
          name: authority.name,
          citation: authority.neutral_citation || '',
          court: authority.court || '',
          year: authority.year || null,
          official_url: authority.official_url || authority.url || '',
          checked: authority.check_status === CHECKED,
          extracts: authorityExtracts
            .filter((extract) => extract.case_law_id === authority.id)
            .map((extract) => ({
              paragraph_ref: extract.paragraph_ref,
              extract_text: extract.extract_text,
              proposition: extract.proposition || '',
              status: extract.status || '',
            })),
        })),
        authorities: authorities.map((authority) => ({
          title: authority.title,
          citation: authority.citation,
        })),
      });

      request.source_material = tickedDocs.map((document) => ({
        name: document.file_name,
        category: document.category,
        party: document.party || '',
        date: document.document_date || '',
        reason: ticked[document.id],
      }));

      const response = await base44.functions.invoke('legalDocumentDraft', request);
      if (response.data?.error) throw new Error(response.data.error);
      setGeneratedContent(response.data.content);
      setShowPreview(true);
      runCounselReview(response.data.content);
    } catch (error) {
      console.error('Generation error:', error);
      alert(`Document generation failed: ${error.message}`);
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

  // The fix button puts the suggested wording on the clipboard, ready to paste into the draft.
  const handleFix = async (item) => {
    if (!item?.fix) return;
    try {
      await navigator.clipboard.writeText(item.fix);
      alert('The suggested fix is on your clipboard.');
    } catch (error) {
      alert(item.fix);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Document Generator</h1>
            <p className="text-slate-600">Drafted from the Argument Builder work and the text of the ticked documents</p>
          </div>
          <Link
            to="/CaseFileLibrary"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
          >
            <FolderOpen className="h-4 w-4" />
            Open Case File Library
          </Link>
        </div>

        <div className="mb-6">
          <div className="mb-3">
            <Label htmlFor="matter">Matter *</Label>
            <Select value={selectedMatter} onValueChange={setSelectedMatter}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select matter..." />
              </SelectTrigger>
              <SelectContent>
                {matters.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.matter_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMatter && (
            <ApplicationContextPanel
              details={details}
              orderId={orderId}
              onOrderChange={setOrderId}
              application={applicationSummary || (details.application || '')}
              onApplicationChange={setApplicationSummary}
              ourSide={ourSide}
              onSideChange={setOurSide}
              court={court}
              onCourtChange={setCourt}
              orderFound={orderFound}
            />
          )}
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
                  placeholder="Anything the model must know that is not in the record. The application, the order challenged, the gateway issues and the paragraphs of the ticked documents are added automatically."
                  value={briefingNotes}
                  onChange={(e) => setBriefingNotes(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700">
                <Checkbox
                  checked={includeSupplementary}
                  onCheckedChange={setIncludeSupplementary}
                  className="mt-0.5"
                />
                Include the supplementary witness statement draft (from the gap analysis fact list)
              </label>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p>
                  {pack.count} paragraph{pack.count === 1 ? '' : 's'} of the ticked documents go with this draft in
                  full ({(pack.chars || 0).toLocaleString()} characters), each with its document id and paragraph number.
                </p>
                <p>
                  {gateway.length} gateway issues, {confirmedTests.length} confirmed test
                  {confirmedTests.length === 1 ? '' : 's'}, {checkedExtracts.length} checked extract
                  {checkedExtracts.length === 1 ? '' : 's'}, {register.summary.unresolved} open register item
                  {register.summary.unresolved === 1 ? '' : 's'}.
                </p>
                <p>
                  {order
                    ? `Order challenged: ${order.name}${order.date_text ? `, ${order.date_text}` : ''}${orderFound ? '' : ' (not ticked — quotes blocked)'}`
                    : 'No order challenged chosen yet — quotes from the order challenged are blocked.'}
                </p>
              </div>

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
            {duplicates.length > 0 && (
              <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {duplicates.length} duplicate document{duplicates.length === 1 ? '' : 's'} ignored (same name and
                size): {duplicates.map((row) => row.file_name).join(', ')} — {duplicates[0].kept_name} is used.
              </p>
            )}
            <SourceMaterialPanel documents={fileDocs} ticked={ticked} onToggle={toggleSource} />
            <ParagraphPackPanel
              pack={pack}
              record={record}
              pinned={pinned}
              onPin={(row) => setPinned((previous) => [...previous.filter((entry) => entry.ref !== row.ref || entry.document_name !== row.document_name), row])}
              onUnpin={(row) => setPinned((previous) => previous.filter((entry) => !(entry.ref === row.ref && entry.document_name === row.document_name)))}
            />
            <DraftList matterId={selectedMatter} />
          </div>
        )}

        {generatedContent && (
          <div className="mt-6 space-y-6">
            <DraftCitationCheck rows={checks} />
            <CounselReview items={review} onFix={handleFix} busy={reviewBusy} />
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