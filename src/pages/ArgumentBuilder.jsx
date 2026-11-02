import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Scale, Loader2, Plus, Sparkles, Upload, X, FileText, CheckCircle, Link as LinkIcon } from 'lucide-react';
import AICoach from '../components/AICoach';
import QuestionStage from '@/components/argument/QuestionStage';
import DraftBody from '@/components/argument/DraftBody';
import AuthorityCheckPanel from '@/components/argument/AuthorityCheckPanel';
import DocumentCheckPanel from '@/components/argument/DocumentCheckPanel';
import ExtractNeededPanel from '@/components/argument/ExtractNeededPanel';
import LegalTestsPanel from '@/components/argument/LegalTestsPanel';
import ConfirmedTestsBanner from '@/components/argument/ConfirmedTestsBanner';
import GapAnalysisPanel from '@/components/argument/GapAnalysisPanel';
import CaseMaterialPanel from '@/components/argument/CaseMaterialPanel';
import ProspectsPanel from '@/components/argument/ProspectsPanel';
import ImproveActions from '@/components/argument/ImproveActions';
import { computeProspects } from '@/lib/prospectsChecklist';
import { buildRecord } from '@/lib/recordIndex';
import { buildSweeps, resolveFromRecord, questionStatus, exhibitClause } from '@/lib/recordFirst';
import { draftMarks } from '@/lib/draftChanges';
import { dedupeAuthorities } from '@/lib/authorityNaming';
import RegisterPanel from '@/components/argument/RegisterPanel';
import useResolutionLoop from '@/hooks/useResolutionLoop';
import { useNavigate } from 'react-router-dom';
import fileToBase64 from '@/lib/fileToBase64';
import { PARTY_TO_FILED_BY } from '@/lib/caseFile';

export default function ArgumentBuilder() {
  const initialMatter = new URLSearchParams(window.location.search).get('matter') || '';
  const [selectedMatter, setSelectedMatter] = useState(initialMatter);
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
  const [linkedDocuments, setLinkedDocuments] = useState({});
  const [questions, setQuestions] = useState([]);
  const [questionRound, setQuestionRound] = useState(0);
  const [isAsking, setIsAsking] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [attachingIndex, setAttachingIndex] = useState(-1);
  const [ourPoints, setOurPoints] = useState([]);
  const [clauses, setClauses] = useState([]);
  const [misstatements, setMisstatements] = useState([]);
  const [procedural, setProcedural] = useState({});
  const [assessment, setAssessment] = useState(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [pendingProposals, setPendingProposals] = useState([]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const { data: mainAuthorities = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date')
  });

  const { data: authorityExtracts = [] } = useQuery({
    queryKey: ['authorityExtracts'],
    queryFn: () => base44.entities.AuthorityExtract.list('-added_date')
  });

  // The record is read from the Case File Library only.
  const { data: matterFiles = [] } = useQuery({
    queryKey: ['caseFileDocuments', selectedMatter],
    queryFn: async () => {
      const page = await base44.entities.CaseFileDocument.filter(
        { matter_id: selectedMatter },
        { sort: '-created_date', limit: 60 }
      );
      return page.items || [];
    },
    enabled: !!selectedMatter
  });

  const { data: legalTests = [] } = useQuery({
    queryKey: ['legalTests', selectedMatter],
    queryFn: () => base44.entities.LegalTest.filter({ matter_id: selectedMatter }),
    enabled: !!selectedMatter
  });

  const { data: registerAnswers = [] } = useQuery({
    queryKey: ['registerAnswers', selectedMatter],
    queryFn: async () => {
      const page = await base44.entities.RegisterAnswer.filter({ matter_id: selectedMatter }, { limit: 200 });
      return page.items || [];
    },
    enabled: !!selectedMatter
  });

  const { data: gapAnalyses = [] } = useQuery({
    queryKey: ['gapAnalyses', selectedMatter],
    queryFn: async () => {
      const page = await base44.entities.GapAnalysis.filter(
        { matter_id: selectedMatter },
        { sort: '-generated_at', limit: 5 }
      );
      return page.items || [];
    },
    enabled: !!selectedMatter
  });

  const latestGap = gapAnalyses[0] || null;
  const confirmedTests = legalTests.filter((test) => test.status === 'Confirmed by user');

  const documentPool = React.useMemo(
    () => [
      ...matterFiles.map((file) => ({ id: file.id, name: file.file_name, text: file.text || '' })),
      ...uploadedDocuments.map((doc, index) => ({ id: `upload-${index + 1}`, name: doc.name, text: doc.content || '' })),
    ],
    [matterFiles, uploadedDocuments]
  );

  const mainAuthorityPool = React.useMemo(
    () => dedupeAuthorities(mainAuthorities.filter((entry) => entry.is_main === true)).items,
    [mainAuthorities]
  );

  const record = React.useMemo(
    () =>
      buildRecord([
        ...matterFiles.map((file) => ({
          id: file.id,
          name: file.file_name,
          text: file.text || '',
          category: file.category,
          record_status: file.record_status,
          filed_by: PARTY_TO_FILED_BY[file.party] || file.filed_by,
          filed_date: file.document_date || file.filed_date,
          exhibit_of: file.exhibit_of
        })),
        ...uploadedDocuments.map((doc, index) => ({
          id: `upload-${index + 1}`,
          name: doc.name,
          text: doc.content || '',
          record_status: 'Draft'
        }))
      ]),
    [matterFiles, uploadedDocuments]
  );

  const sweeps = React.useMemo(() => buildSweeps(record, ourPoints), [record, ourPoints]);

  const { data: argumentVersions = [] } = useQuery({
    queryKey: ['argumentVersions', selectedMatter],
    queryFn: async () => {
      const page = await base44.entities.Argument.filter(
        { matter_id: selectedMatter },
        { sort: '-version_number', limit: 30 }
      );
      return page.items || [];
    },
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
      const savedArguments = await base44.entities.Argument.filter(
        { matter_id: selectedMatter },
        '-version_number',
        1
      );

      if (savedArguments.length > 0) {
        const lastVersion = savedArguments[0];
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

        setQuestions(lastVersion.questions || []);
        setQuestionRound(lastVersion.question_round || 0);
        setOurPoints(lastVersion.our_points || []);
        setClauses(lastVersion.contract_clauses || []);
        setMisstatements(lastVersion.misstatements || []);
        setProcedural(lastVersion.procedural || {});
        setAssessment(lastVersion.prospects?.assessment || null);

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
      for (const file of files) {
        const fileBase64 = await fileToBase64(file);

        const extractResponse = await base44.functions.invoke('documentTextExtract', {
          fileName: file.name,
          fileBase64
        });

        if (extractResponse.data?.error) throw new Error(extractResponse.data.error);
        const text = extractResponse.data?.text || '';

        // Uploads go straight into the Case File Library, which is the record.
        await base44.entities.CaseFileDocument.create({
          matter_id: selectedMatter,
          file_name: file.name,
          category: 'Other',
          party: 'Ours',
          document_date: new Date().toISOString().slice(0, 10),
          record_status: 'Filed or served',
          file_uri: extractResponse.data?.file_uri || '',
          text: text.slice(0, 120000),
          char_count: text.length,
          truncated: text.length > 120000,
          source: 'Argument Builder upload'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['caseFileDocuments', selectedMatter] });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  const removeDocument = (index) => {
    const newDocs = uploadedDocuments.filter((_, i) => i !== index);
    setUploadedDocuments(newDocs);
    // Remove any links to this document
    const newLinked = { ...linkedDocuments };
    Object.keys(newLinked).forEach(key => {
      newLinked[key] = newLinked[key].filter((_, i) => i !== index);
    });
    setLinkedDocuments(newLinked);
  };

  const linkDocumentToPoint = (docIndex, pointType) => {
    setLinkedDocuments(prev => ({
      ...prev,
      [pointType]: [...(prev[pointType] || []), docIndex]
    }));
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
      const response = await base44.functions.invoke('legalArgumentDraft', {
        position,
        court: currentMatter.court,
        matterName: currentMatter.matter_name,
        matterType: currentMatter.matter_type,
        factPattern,
        issueTitle: selectedIssue ? (issues.find(i => i.id === selectedIssue)?.issue_title || '') : '',
        expansions: {
          chronology,
          disputed_facts: disputedFacts,
          undisputed_facts: undisputedFacts,
          legal_issues_raised: legalIssuesRaised,
          procedural_history: proceduralHistory,
          loss_harm_risk: lossHarmRisk
        },
        authorities: authorities.map(a => ({
          title: a.title,
          citation: a.citation,
          legal_principle: a.legal_principle,
          status: a.tags?.find(t => ['Active', 'Overruled'].includes(t)) || 'Active'
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
            }))
        })),
        question_answers: questions
          .filter((question) => (question.answer || '').trim() || question.status)
          .map((question) => ({
            question: question.question,
            answer: question.answer,
            status: question.status,
            quote: question.quote,
            document_name: question.document_name,
            conflict_resolution: question.conflict_resolution
          })),
        our_points: ourPoints,
        contract_clauses: clauses,
        misstatements,
        legal_tests: confirmedTests.map((test) => ({
          name: test.name,
          source_name: mainAuthorities.find((record) => record.id === test.source_case_law_id)?.name || '',
          elements: (test.elements || []).map((element) => ({
            text: element.text,
            source_document_name: element.source_document_name || '',
            source_paragraph_ref: element.source_paragraph_ref || '',
            source_extract_ref: element.source_extract_id
              ? (authorityExtracts.find((extract) => extract.id === element.source_extract_id)?.paragraph_ref || 'stored extract')
              : ''
          }))
        })),
        documents: [
          ...matterFiles.map((file) => ({
            id: file.id,
            name: file.file_name,
            content: file.text || '',
            filed_by: PARTY_TO_FILED_BY[file.party] || file.filed_by || '',
            record_status: file.record_status || 'Filed or served'
          })),
          ...uploadedDocuments.map((doc, idx) => ({
            id: `upload-${idx + 1}`,
            name: doc.name,
            content: doc.content,
            linked_to: Object.entries(linkedDocuments)
              .filter(([, docs]) => docs.includes(idx))
              .map(([point]) => point)
          }))
        ]
      });

      setGeneratedArgument({ full_argument_markdown: response.data.argument });
      setDraftChanges(compareNewDraft(response.data.argument));
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
      const response = await base44.functions.invoke('legalArgumentFactCheck', {
        argument: generatedArgument.full_argument_markdown,
        factPattern
      });

      setGeneratedArgument({ full_argument_markdown: response.data.argument });
      alert('Facts reviewed and corrected');
    } catch (error) {
      console.error('Correction error:', error);
      alert('Failed to correct facts');
    } finally {
      setIsCorrectingFacts(false);
    }
  };

  const prospects = computeProspects({
    text: generatedArgument?.full_argument_markdown || '',
    questions,
    ourPoints,
    clauses,
    misstatements,
    procedural,
    caseLaw: mainAuthorities,
    extracts: authorityExtracts,
    legalTests,
    gap: latestGap,
    record
  });

  const checklistKey = prospects.checklist.map((item) => `${item.id}:${item.result}`).join('|');
  const {
    register,
    chronology: chronologyData,
    missingDocs,
    fillNote,
    draftChanges,
    setDraftChanges,
    applyAutoFill,
    applyRegisterAnswer,
    useProposal: handleUseProposal,
    fixCitation: handleFixCitation,
    compare: compareNewDraft
  } = useResolutionLoop({
    matterId: selectedMatter,
    record,
    checklistKey,
    checklist: prospects.checklist,
    legalTests,
    registerAnswers,
    undisputedFacts,
    generatedArgument,
    pendingProposals,
    setPendingProposals,
    materials: { ourPoints, clauses, misstatements, factPattern, chronology, lossHarmRisk },
    setters: { setOurPoints, setClauses, setMisstatements, setFactPattern, setChronology, setLossHarmRisk },
    setGeneratedArgument
  });

  // A checklist item is met once a verified record quotation answers it.
  const prospectsView = React.useMemo(() => {
    const checklist = prospects.checklist.map((item) => {
      const proof = register.items.find((entry) => entry.id === `check-${item.id}`)?.evidence?.[0];
      if (!proof || item.result === 'Yes') return item;
      return {
        ...item,
        result: 'Yes',
        reason: `${item.reason ? `${item.reason} ` : ''}Verified in the record: ${proof.document_name}, ${proof.ref}.`
      };
    });
    return { ...prospects, checklist };
  }, [checklistKey, register]);

  const openUpload = () => document.getElementById('documents')?.click();

  const prospectsHistory = argumentVersions
    .filter((record) => record.prospects?.rating)
    .slice()
    .sort((a, b) => (a.version_number || 0) - (b.version_number || 0))
    .map((record) => ({ version: record.version_number, rating: record.prospects.rating }));

  const updateQuestion = (index, patch) => {
    setQuestions((prev) => prev.map((question, position) => (position === index ? { ...question, ...patch } : question)));
  };

  const questionPayload = () => ({
    matter_id: selectedMatter,
    position,
    fact_pattern: factPattern,
    our_points: ourPoints,
    contract_clauses: clauses,
    misstatements
  });

  const applyRecordAnswer = (question) => {
    const resolution = resolveFromRecord(record, `${question.question || ''} ${question.why || ''}`);
    const first = resolution.quotes[0];
    return {
      ...question,
      status: questionStatus(resolution),
      quote: first?.quote || '',
      document_name: first?.document_name || '',
      answer: resolution.outcome === 'ANSWERED FROM RECORD' && first ? first.quote : ''
    };
  };

  const handleRecordChange = async (id, patch) => {
    if (String(id).startsWith('upload-')) return;
    await base44.entities.CaseFileDocument.update(id, patch);
    queryClient.invalidateQueries({ queryKey: ['caseFileDocuments', selectedMatter] });
  };

  const handleAskQuestions = async () => {
    if (!selectedMatter) {
      alert('Select a matter first');
      return;
    }
    setIsAsking(true);
    try {
      const response = await base44.functions.invoke('argumentQuestions', { ...questionPayload(), mode: 'questions' });
      if (response.data?.error) throw new Error(response.data.error);
      const asked = (response.data.questions || []).map((question) => ({
        ...question,
        answer: '',
        quote: '',
        document_name: '',
        status: 'Open',
        conflict: '',
        conflict_detail: '',
        conflict_resolution: '',
        round: 1
      }));
      setQuestions(asked.map(applyRecordAnswer));
      setQuestionRound(1);
    } catch (error) {
      alert(`Could not prepare questions: ${error.message}`);
    } finally {
      setIsAsking(false);
    }
  };

  const handleFollowUp = async () => {
    if (!selectedMatter || questionRound >= 3) return;
    setIsAsking(true);
    try {
      const nextRound = questionRound + 1;
      const response = await base44.functions.invoke('argumentQuestions', {
        ...questionPayload(),
        mode: 'followup',
        round: nextRound,
        questions
      });
      if (response.data?.error) throw new Error(response.data.error);
      const asked = (response.data.questions || []).map((question) => ({
        ...question,
        answer: '',
        quote: '',
        document_name: '',
        status: 'Open',
        conflict: '',
        conflict_detail: '',
        conflict_resolution: '',
        round: nextRound
      }));
      setQuestions([...questions, ...asked.map(applyRecordAnswer)]);
      setQuestionRound(nextRound);
    } catch (error) {
      alert(`Could not prepare follow-up questions: ${error.message}`);
    } finally {
      setIsAsking(false);
    }
  };

  const handleCheckConflicts = async () => {
    const answered = questions
      .map((question, index) => ({ ...question, index }))
      .filter((question) => (question.answer || '').trim());

    if (answered.length === 0) {
      alert('Answer at least one question first');
      return;
    }

    setConflictBusy(true);
    try {
      const response = await base44.functions.invoke('argumentQuestions', {
        mode: 'conflict',
        matter_id: selectedMatter,
        answers: answered.map((question) => ({
          index: question.index,
          question: question.question,
          answer: question.answer,
          quote: question.quote,
          document_name: question.document_name,
          evidence_text: question.evidence_text
        }))
      });
      if (response.data?.error) throw new Error(response.data.error);
      const results = response.data.results || [];
      setQuestions((prev) =>
        prev.map((question, index) => {
          const result = results.find((entry) => entry.index === index);
          if (!result) return question;
          return {
            ...question,
            conflict: result.conflict ? result.conflict_detail : '',
            conflict_detail: result.conflict_detail || '',
            conflict_resolution: result.conflict ? '' : question.conflict_resolution
          };
        })
      );
    } catch (error) {
      alert(`Conflict check failed: ${error.message}`);
    } finally {
      setConflictBusy(false);
    }
  };

  const handleAttachQuestionDoc = async (index, file) => {
    setAttachingIndex(index);
    try {
      const fileBase64 = await fileToBase64(file);
      const response = await base44.functions.invoke('documentTextExtract', { fileName: file.name, fileBase64 });
      updateQuestion(index, {
        document_name: file.name,
        evidence_text: (response.data?.text || '').slice(0, 4000)
      });
    } catch (error) {
      alert('Could not read that document');
    } finally {
      setAttachingIndex(-1);
    }
  };

  const convertAnswerToPoint = (index) => {
    const question = questions[index];
    if (!question || !(question.answer || '').trim()) return;
    setOurPoints([
      ...ourPoints,
      {
        text: question.answer.trim(),
        document_name: question.document_name || '',
        paragraph_ref: '',
        source: 'Answer',
        added_date: new Date().toISOString()
      }
    ]);
  };

  const handleAssess = async () => {
    if (!generatedArgument || !selectedMatter) {
      alert('Generate or open an argument version first');
      return;
    }
    setIsAssessing(true);
    try {
      const response = await base44.functions.invoke('argumentProspects', {
        matter_id: selectedMatter,
        position,
        argument_text: generatedArgument.full_argument_markdown,
        checklist: prospectsView.checklist,
        our_points: ourPoints,
        contract_clauses: clauses,
        misstatements
      });
      if (response.data?.error) throw new Error(response.data.error);
      setAssessment(response.data.assessment || null);
    } catch (error) {
      alert(`Assessment failed: ${error.message}`);
    } finally {
      setIsAssessing(false);
    }
  };

  const handleImproveAction = (type) => {
    if (type === 'document') {
      document.getElementById('documents')?.click();
    } else if (type === 'authority') {
      navigate('/CaseLawLibrary');
    } else if (type === 'point') {
      document.getElementById('material-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('point-input')?.focus();
    } else if (type === 'clause') {
      document.getElementById('material-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('clause-reference')?.focus();
    } else if (type === 'find_test') {
      document.getElementById('find-test')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (type === 'test') {
      document.getElementById('legal-tests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (type === 'factlist') {
      document.getElementById('gap-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      document.getElementById('question-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        our_points: ourPoints,
        contract_clauses: clauses,
        misstatements,
        procedural,
        questions,
        question_round: questionRound,
        prospects: { ...prospectsView, ...(assessment ? { assessment } : {}), generated_at: new Date().toISOString() },
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

        {selectedMatter && (
          <div className="mb-6">
            <ConfirmedTestsBanner tests={legalTests} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        <div key={idx} className="bg-green-50 border border-green-200 rounded p-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-700" />
                              <span className="text-xs text-green-900">{doc.name}</span>
                            </div>
                            <button onClick={() => removeDocument(idx)} className="text-green-700 hover:text-green-900">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button 
                              onClick={() => linkDocumentToPoint(idx, 'chronology')}
                              className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              <LinkIcon className="h-2 w-2 inline mr-1" />
                              Chronology
                            </button>
                            <button 
                              onClick={() => linkDocumentToPoint(idx, 'disputed_facts')}
                              className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              <LinkIcon className="h-2 w-2 inline mr-1" />
                              Disputed
                            </button>
                            <button 
                              onClick={() => linkDocumentToPoint(idx, 'evidence')}
                              className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                            >
                              <LinkIcon className="h-2 w-2 inline mr-1" />
                              Evidence
                            </button>
                          </div>
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

              {mainAuthorityPool.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-900 font-medium">
                    ✓ {mainAuthorityPool.length} main {mainAuthorityPool.length === 1 ? 'authority' : 'authorities'} cited first, quotable only from {authorityExtracts.length} stored extract{authorityExtracts.length === 1 ? '' : 's'}
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

          {/* AI Coach Panel */}
          <AICoach
            factPattern={factPattern}
            generatedArgument={generatedArgument}
            currentMatter={currentMatter}
            authorities={authorities}
            position={position}
            extracts={authorityExtracts
              .filter((extract) => mainAuthorityPool.some((record) => record.id === extract.case_law_id))
              .map((extract) => ({
                authority: mainAuthorityPool.find((record) => record.id === extract.case_law_id)?.name || '',
                citation: mainAuthorityPool.find((record) => record.id === extract.case_law_id)?.neutral_citation || '',
                paragraph_ref: extract.paragraph_ref || '',
                exact_text: extract.extract_text || '',
                proposition: extract.proposition || '',
                status:
                  extract.status ||
                  (mainAuthorityPool.find((record) => record.id === extract.case_law_id)?.check_status ===
                  'Extract checked against official text'
                    ? 'Extract checked against official text'
                    : 'Proposed - compare with the official text'),
              }))}
          />

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
                <DraftBody
                  text={generatedArgument.full_argument_markdown}
                  documents={documentPool}
                  className="prose prose-slate max-w-none bg-white p-6 rounded-lg border overflow-y-auto max-h-[700px]"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {selectedMatter && (
          <div id="material-panel" className="mt-6 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={applyAutoFill}>
                Refresh from record
              </Button>
              {fillNote && <span className="text-xs text-slate-600">{fillNote}</span>}
            </div>
            <CaseMaterialPanel
              ourPoints={ourPoints}
              onAddPoint={(point) => setOurPoints([...ourPoints, { ...point, source: 'Manual', added_date: new Date().toISOString() }])}
              onRemovePoint={(index) => setOurPoints(ourPoints.filter((_, position) => position !== index))}
              clauses={clauses}
              onAddClause={(clause) => setClauses([...clauses, clause])}
              onRemoveClause={(index) => setClauses(clauses.filter((_, position) => position !== index))}
              onToggleClause={(index) =>
                setClauses(clauses.map((clause, position) => (position === index ? { ...clause, checked: !clause.checked } : clause)))
              }
              misstatements={misstatements}
              onAddMisstatement={(entry) => setMisstatements([...misstatements, entry])}
              onRemoveMisstatement={(index) => setMisstatements(misstatements.filter((_, position) => position !== index))}
              procedural={procedural}
              onProceduralChange={setProcedural}
              record={record}
              sweeps={sweeps}
              onRecordChange={handleRecordChange}
              onUseClause={(row) => setClauses([...clauses, exhibitClause(row)])}
              chronology={chronologyData}
              onUseChronology={(text) => setChronology(text)}
              missingDocs={missingDocs}
              onUploadDoc={openUpload}
            />
          </div>
        )}

        <div id="question-stage" className="mt-6">
          <QuestionStage
            questions={questions}
            round={questionRound}
            busy={isAsking}
            conflictBusy={conflictBusy}
            conflictChecked={questions.some((question) => question.conflict)}
            hasMatter={Boolean(selectedMatter)}
            onChange={updateQuestion}
            onConvert={convertAnswerToPoint}
            onAttach={handleAttachQuestionDoc}
            attachingIndex={attachingIndex}
            onAsk={handleAskQuestions}
            onFollowUp={handleFollowUp}
            onCheckConflicts={handleCheckConflicts}
            onDraft={handleGenerate}
            record={record}
          />
        </div>

        {selectedMatter && (
          <div className="mt-6">
            <LegalTestsPanel
              matterId={selectedMatter}
              tests={legalTests}
              extracts={authorityExtracts}
              caseLaw={mainAuthorities}
              points={[
                ...ourPoints.map((point) => ({ kind: 'our point', text: point.text })),
                ...misstatements.map((entry) => ({ kind: 'misstatement', text: entry.statement })),
              ]}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['legalTests', selectedMatter] });
                queryClient.invalidateQueries({ queryKey: ['authorityExtracts'] });
              }}
            />
          </div>
        )}

        {selectedMatter && (
          <div className="mt-6">
            <GapAnalysisPanel
              matterId={selectedMatter}
              matterName={currentMatter?.matter_name || ''}
              court={currentMatter?.court || ''}
              ourPoints={ourPoints}
              tests={legalTests}
              gap={latestGap}
              record={record}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['gapAnalyses', selectedMatter] })}
            />
          </div>
        )}

        {selectedMatter && (
          <>
            <div className="mt-6">
              <ProspectsPanel
                prospects={prospectsView}
                assessment={assessment}
                isAssessing={isAssessing}
                onAssess={handleAssess}
                savedRating={currentArgumentVersion?.prospects?.rating || ''}
                history={prospectsHistory}
                canAssess={Boolean(generatedArgument)}
              />
            </div>

            <div className="mt-6">
              <ImproveActions actions={prospects.actions} onAction={handleImproveAction} />
            </div>

            <div className="mt-6">
              <RegisterPanel
                register={register}
                record={record}
                onAnswer={applyRegisterAnswer}
                onUpload={openUpload}
                onFixCitation={handleFixCitation}
                onUseProposal={handleUseProposal}
                onRerun={handleGenerate}
                busy={isGenerating}
                changes={draftChanges}
                marks={draftMarks(generatedArgument?.full_argument_markdown || '')}
              />
            </div>
          </>
        )}

        {generatedArgument && generatedArgument.full_argument_markdown && (
          <div className="mt-6 space-y-6">
            <AuthorityCheckPanel
              text={generatedArgument.full_argument_markdown}
              extracts={authorityExtracts.filter((extract) =>
                mainAuthorityPool.some((record) => record.id === extract.case_law_id)
              )}
              mainAuthorities={mainAuthorityPool}
            />
            <DocumentCheckPanel
              text={generatedArgument.full_argument_markdown}
              documents={documentPool}
              extracts={authorityExtracts}
            />
            <ExtractNeededPanel
              text={generatedArgument.full_argument_markdown}
              caseLaw={mainAuthorities}
              record={record}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['authorityExtracts'] })}
            />
          </div>
        )}
      </div>
    </div>
  );
}