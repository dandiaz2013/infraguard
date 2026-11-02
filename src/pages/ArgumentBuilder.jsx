import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, Loader2, Plus, Sparkles, CheckCircle, Upload } from 'lucide-react';
import AICoach from '@/components/AICoach';
import QuestionStage from '@/components/argument/QuestionStage';
import DraftBody from '@/components/argument/DraftBody';
import AuthorityCheckPanel from '@/components/argument/AuthorityCheckPanel';
import DocumentCheckPanel from '@/components/argument/DocumentCheckPanel';
import ExtractNeededPanel from '@/components/argument/ExtractNeededPanel';
import GapAnalysisPanel from '@/components/argument/GapAnalysisPanel';
import CaseMaterialPanel from '@/components/argument/CaseMaterialPanel';
import CaseBrief from '@/components/argument/CaseBrief';
import GatewayPanel from '@/components/argument/GatewayPanel';
import TestFromMainAuthority from '@/components/argument/TestFromMainAuthority';
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
import { toRecordDoc, PARTY_TO_FILED_BY } from '@/lib/caseFile';
import { classifyDocument } from '@/lib/documentType';
import { dateFromDocument } from '@/lib/documentDate';
import { promptnessFor } from '@/lib/promptness';
import { buildGateway, gatewayProspects } from '@/lib/gateway';
import { buildCaseBrief } from '@/lib/caseBrief';
import { SAFETY_FOOTER } from '@/lib/safety';

const TABS = [
  ['record', 'Record'],
  ['gateway', 'Gateway'],
  ['draft', 'Draft'],
  ['checks', 'Checks'],
  ['questions', 'Questions']
];

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
  const [isUploading, setIsUploading] = useState(false);
  const [isCorrectingFacts, setIsCorrectingFacts] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentArgumentVersion, setCurrentArgumentVersion] = useState(null);
  const [isLoadingLastVersion, setIsLoadingLastVersion] = useState(false);
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
  const [tab, setTab] = useState('record');

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const migrated = useRef('');

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.filter({ status: 'Active' })
  });

  const { data: currentMatter } = useQuery({
    queryKey: ['matter', selectedMatter],
    queryFn: async () => {
      const rows = await base44.entities.Matter.filter({ id: selectedMatter });
      return rows[0];
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

  const { data: caseLaw = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date')
  });

  const { data: authorityExtracts = [] } = useQuery({
    queryKey: ['authorityExtracts'],
    queryFn: () => base44.entities.AuthorityExtract.list('-added_date')
  });

  // The record is the Case File Library only.
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

  const latestGap = gapAnalyses[0] || null;
  const mainAuthorityPool = useMemo(
    () => dedupeAuthorities(caseLaw.filter((entry) => entry.is_main === true)).items,
    [caseLaw]
  );
  const mainAuthorityId = procedural.main_authority_id || mainAuthorityPool[0]?.id || '';
  const mainAuthority = mainAuthorityPool.find((record) => record.id === mainAuthorityId) || null;

  const documentPool = useMemo(
    () => matterFiles.map((file) => ({ id: file.id, name: file.file_name, text: file.text || '' })),
    [matterFiles]
  );

  const record = useMemo(() => buildRecord(matterFiles.map(toRecordDoc)), [matterFiles]);
  const sweeps = useMemo(() => buildSweeps(record, ourPoints), [record, ourPoints]);
  const extracted = useMemo(
    () =>
      mainAuthorityId
        ? authorityExtracts.filter((extract) => extract.case_law_id === mainAuthorityId)
        : authorityExtracts.filter((extract) => mainAuthorityPool.some((entry) => entry.id === extract.case_law_id)),
    [authorityExtracts, mainAuthorityId, mainAuthorityPool]
  );

  const promptness = useMemo(
    () => promptnessFor({ record, orderId: procedural.order_document_id || '', extracts: extracted }),
    [record, procedural.order_document_id, extracted]
  );
  const gateway = useMemo(
    () => buildGateway({ record, extracts: extracted, promptness }),
    [record, extracted, promptness]
  );
  const prospects = useMemo(() => gatewayProspects(gateway), [gateway]);
  const dismissedDocs = procedural.dismissed_documents || [];

  const confirmedTests = legalTests.filter(
    (test) =>
      test.status === 'Confirmed by user' &&
      test.usage !== 'Background: tests applied in the earlier decision' &&
      (!mainAuthorityId || test.source_case_law_id === mainAuthorityId)
  );

  // Load the last saved version when the matter changes.
  useEffect(() => {
    if (selectedMatter) loadLastArgumentVersion();
  }, [selectedMatter]);

  useEffect(() => {
    if (currentMatter && !currentArgumentVersion) setFactPattern(currentMatter.description || '');
  }, [currentMatter, currentArgumentVersion]);

  useEffect(() => {
    if (generatedArgument) setHasUnsavedChanges(true);
  }, [generatedArgument]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved legal work. Are you sure you want to leave?';
        return event.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Tests confirmed from a judgment in the file are background, not tests for this application.
  useEffect(() => {
    if (!selectedMatter || !mainAuthorityId || legalTests.length === 0) return;
    const key = `${selectedMatter}:${mainAuthorityId}`;
    if (migrated.current === key) return;
    const challengedNames = matterFiles
      .filter((file) => file.category === 'Judgments' || file.category === 'Orders')
      .map((file) => String(file.file_name || '').toLowerCase());
    const fromChallenged = (test) =>
      (test.elements || []).some(
        (element) =>
          element.source_document_name &&
          challengedNames.includes(String(element.source_document_name).toLowerCase())
      );
    const strays = legalTests.filter(
      (test) =>
        test.status === 'Confirmed by user' &&
        test.usage !== 'Background: tests applied in the earlier decision' &&
        (test.source_case_law_id !== mainAuthorityId || fromChallenged(test))
    );
    migrated.current = key;
    if (strays.length === 0) return;
    Promise.all(
      strays.map((test) =>
        base44.entities.LegalTest.update(test.id, { usage: 'Background: tests applied in the earlier decision' })
      )
    ).then(() => queryClient.invalidateQueries({ queryKey: ['legalTests', selectedMatter] }));
  }, [selectedMatter, mainAuthorityId, legalTests, matterFiles]);

  const loadLastArgumentVersion = async () => {
    if (!selectedMatter) return;
    setIsLoadingLastVersion(true);
    try {
      const saved = await base44.entities.Argument.filter({ matter_id: selectedMatter }, '-version_number', 1);
      if (saved.length > 0) {
        const lastVersion = saved[0];
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
        if (lastVersion.argument_text) setGeneratedArgument({ full_argument_markdown: lastVersion.argument_text });
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

  // Uploads go into the Case File Library, classified from the document itself.
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !selectedMatter) return;
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
        const verdict = classifyDocument({ file_name: file.name, text });
        await base44.entities.CaseFileDocument.create({
          matter_id: selectedMatter,
          file_name: file.name,
          category: verdict.category,
          party: verdict.party,
          document_date: dateFromDocument(text, verdict.category),
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
      alert(`Failed to upload documents: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordChange = async (id, patch) => {
    if (!id) return;
    await base44.entities.CaseFileDocument.update(id, patch);
    queryClient.invalidateQueries({ queryKey: ['caseFileDocuments', selectedMatter] });
  };

  const setOrder = (orderDocumentId) =>
    setProcedural((prev) => ({ ...prev, order_document_id: orderDocumentId }));

  const setMainAuthority = (id) => setProcedural((prev) => ({ ...prev, main_authority_id: id }));

  const dismissDoc = (docId) =>
    setProcedural((prev) => ({
      ...prev,
      dismissed_documents: [...(prev.dismissed_documents || []), docId]
    }));

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
        issueTitle: selectedIssue ? issues.find((entry) => entry.id === selectedIssue)?.issue_title || '' : '',
        expansions: {
          chronology,
          disputed_facts: disputedFacts,
          undisputed_facts: undisputedFacts,
          legal_issues_raised: legalIssuesRaised,
          procedural_history: proceduralHistory,
          loss_harm_risk: lossHarmRisk
        },
        authorities: authorities.map((entry) => ({
          title: entry.title,
          citation: entry.citation,
          legal_principle: entry.legal_principle,
          status: entry.tags?.find((tag) => ['Active', 'Overruled'].includes(tag)) || 'Active'
        })),
        main_authorities: mainAuthorityPool
          .filter((entry) => !mainAuthorityId || entry.id === mainAuthorityId)
          .map((entry) => ({
            name: entry.name,
            citation: entry.neutral_citation || '',
            court: entry.court || '',
            year: entry.year || null,
            official_url: entry.official_url || entry.url || '',
            checked: entry.check_status === 'Extract checked against official text',
            extracts: authorityExtracts
              .filter((extract) => extract.case_law_id === entry.id)
              .map((extract) => ({
                paragraph_ref: extract.paragraph_ref,
                extract_text: extract.extract_text,
                proposition: extract.proposition || '',
                status: extract.status || ''
              }))
          })),
        gateway: gateway.map((issue) => ({
          number: issue.number,
          title: issue.title,
          ask: issue.ask,
          rating: issue.rating,
          rating_reason: issue.reason,
          our_answer: issue.ours
            ? { quote: issue.ours.quote, document_name: issue.ours.document_name, ref: issue.ours.ref }
            : null,
          their_answer: issue.theirs
            ? { quote: issue.theirs.quote, document_name: issue.theirs.document_name, ref: issue.theirs.ref }
            : null,
          gap: issue.gap,
          next_step: issue.next
        })),
        promptness_note: promptness.note,
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
          source_name: mainAuthority?.name || '',
          elements: (test.elements || []).map((element) => ({
            text: element.text,
            source_paragraph_ref: element.source_paragraph_ref || ''
          }))
        })),
        documents: matterFiles.map((file) => ({
          id: file.id,
          name: file.file_name,
          content: file.text || '',
          filed_by: PARTY_TO_FILED_BY[file.party] || file.filed_by || '',
          category: file.category || '',
          record_status: file.record_status || 'Filed or served'
        }))
      });

      setGeneratedArgument({ full_argument_markdown: response.data.argument });
      setDraftChanges(compareNewDraft(response.data.argument));
      setTab('draft');
    } catch (error) {
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
    } catch (error) {
      alert('Failed to correct facts');
    } finally {
      setIsCorrectingFacts(false);
    }
  };

  const checklistProspects = computeProspects({
    text: generatedArgument?.full_argument_markdown || '',
    questions,
    ourPoints,
    clauses,
    misstatements,
    procedural,
    caseLaw,
    extracts: authorityExtracts,
    legalTests,
    gap: latestGap,
    record
  });

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
    checklistKey: checklistProspects.checklist.map((item) => `${item.id}:${item.result}`).join('|'),
    checklist: checklistProspects.checklist,
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

  const brief = useMemo(
    () => buildCaseBrief({ matter: currentMatter, gateway, promptness, missingDocs, dismissed: dismissedDocs, ourPoints }),
    [currentMatter, gateway, promptness, missingDocs, dismissedDocs, ourPoints]
  );

  const prospectsHistory = argumentVersions
    .filter((entry) => entry.prospects?.rating)
    .slice()
    .sort((a, b) => (a.version_number || 0) - (b.version_number || 0))
    .map((entry) => ({ version: entry.version_number, rating: entry.prospects.rating }));

  const updateQuestion = (index, patch) =>
    setQuestions((prev) => prev.map((question, position) => (position === index ? { ...question, ...patch } : question)));

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

  // At most five questions, yes or no first.
  const handleAskQuestions = async () => {
    if (!selectedMatter) return;
    setIsAsking(true);
    try {
      const response = await base44.functions.invoke('argumentQuestions', { ...questionPayload(), mode: 'questions' });
      if (response.data?.error) throw new Error(response.data.error);
      const asked = (response.data.questions || []).slice(0, 5).map((question) => ({
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
    if (!selectedMatter || questions.length >= 5) return;
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
      const room = Math.max(0, 5 - questions.length);
      const asked = (response.data.questions || []).slice(0, room).map((question) => ({
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
    const answered = questions.map((question, index) => ({ ...question, index })).filter((question) => (question.answer || '').trim());
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
        checklist: checklistProspects.checklist,
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
      setTab('record');
      setTimeout(() => document.getElementById('documents')?.click(), 100);
    } else if (type === 'authority') {
      navigate('/CaseLawLibrary');
    } else if (type === 'find_test' || type === 'test') {
      setTab('gateway');
    } else if (type === 'factlist') {
      setTab('checks');
    } else {
      setTab('questions');
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
        position,
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
        authorities: authorities.map((entry) => entry.id),
        our_points: ourPoints,
        contract_clauses: clauses,
        misstatements,
        procedural,
        questions,
        question_round: questionRound,
        prospects: {
          rating: prospects.rating,
          explanation: prospects.explanation,
          issues: gateway.map((issue) => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            rating: issue.rating,
            reason: issue.reason
          })),
          ...(assessment ? { assessment } : {}),
          generated_at: new Date().toISOString()
        },
        status: 'Draft',
        parent_version_id: currentArgumentVersion?.id
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries(['arguments']);
      await loadLastArgumentVersion();
      alert(`Argument saved as Version ${nextVersion}`);
    } catch (error) {
      alert('Failed to save argument');
    }
  };

  const openRecordAt = () => {
    setTab('record');
    setTimeout(() => document.getElementById('record-documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Scale className="h-6 w-6 text-slate-700" />
              Argument Builder
            </h1>
            <p className="text-sm text-slate-600">One screen, seven gateway issues, everything taken from the record.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-[11px]">Matter</Label>
              <Select
                value={selectedMatter}
                onValueChange={(value) => {
                  setSelectedMatter(value);
                  setSelectedIssue('');
                }}
              >
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue placeholder="Select matter" />
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
              <Label className="text-[11px]">Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Claimant', 'Defendant', 'Appellant', 'Respondent'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleGenerate} disabled={isGenerating || !selectedMatter}>
              {isGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate
            </Button>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={!generatedArgument}>
              <Plus className="h-4 w-4 mr-1" />
              Save version
            </Button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <Badge variant="destructive" className="animate-pulse">
            Unsaved changes {currentArgumentVersion ? `— last saved v${currentArgumentVersion.version_number}` : ''}
          </Badge>
        )}

        {!selectedMatter && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-600">
              Pick a matter to build the Case Brief from its record.
            </CardContent>
          </Card>
        )}

        {selectedMatter && (
          <>
            <CaseBrief brief={brief} gateway={gateway} onOpenTab={setTab} />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {TABS.map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="text-xs">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="record" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">The record</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="documents"
                        type="file"
                        multiple
                        accept=".pdf,.txt,.doc,.docx"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="block text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
                      />
                      {isUploading && (
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…
                        </span>
                      )}
                      <Button size="sm" variant="outline" onClick={applyAutoFill}>
                        Refresh from record
                      </Button>
                      {fillNote && <span className="text-xs text-slate-600">{fillNote}</span>}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Each document is classified from its own text: only judgments, orders and transcripts count as the
                      Court.
                    </p>
                  </CardContent>
                </Card>

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
                  onUploadDoc={() => document.getElementById('documents')?.click()}
                  dismissedDocs={dismissedDocs}
                  onDismissDoc={dismissDoc}
                />
              </TabsContent>

              <TabsContent value="gateway" className="space-y-4">
                <TestFromMainAuthority
                  matterId={selectedMatter}
                  authorities={mainAuthorityPool}
                  extracts={authorityExtracts}
                  tests={legalTests}
                  selectedId={mainAuthorityId}
                  onSelect={setMainAuthority}
                  points={[...ourPoints.map((point) => ({ kind: 'our point', text: point.text }))]}
                  onRefresh={() => {
                    queryClient.invalidateQueries({ queryKey: ['legalTests', selectedMatter] });
                    queryClient.invalidateQueries({ queryKey: ['authorityExtracts'] });
                  }}
                />

                <GatewayPanel
                  issues={gateway}
                  promptness={promptness}
                  orderId={procedural.order_document_id || ''}
                  onOrderChange={setOrder}
                  onOpenRecord={openRecordAt}
                />

                <ProspectsPanel
                  rating={prospects.rating}
                  explanation={prospects.explanation}
                  issues={gateway}
                  savedRating={currentArgumentVersion?.prospects?.rating || ''}
                  history={prospectsHistory}
                  assessment={assessment}
                  isAssessing={isAssessing}
                  onAssess={handleAssess}
                  canAssess={Boolean(generatedArgument)}
                />
              </TabsContent>

              <TabsContent value="draft" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Facts and expansions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="facts" className="text-xs">Core fact pattern *</Label>
                      <Textarea
                        id="facts"
                        value={factPattern}
                        onChange={(event) => setFactPattern(event.target.value)}
                        rows={4}
                        className="text-sm bg-slate-50"
                        placeholder="Auto-populated from the matter. Edit as needed."
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['chronology', 'Chronology', chronology, setChronology],
                        ['disputed', 'Disputed facts', disputedFacts, setDisputedFacts],
                        ['undisputed', 'Undisputed facts', undisputedFacts, setUndisputedFacts],
                        ['legal_issues', 'Legal issues raised', legalIssuesRaised, setLegalIssuesRaised],
                        ['procedural', 'Procedural history', proceduralHistory, setProceduralHistory],
                        ['loss', 'Loss, harm or risk', lossHarmRisk, setLossHarmRisk]
                      ].map(([id, label, value, setter]) => (
                        <div key={id}>
                          <Label htmlFor={id} className="text-xs">{label}</Label>
                          <Textarea id={id} value={value} onChange={(event) => setter(event.target.value)} rows={2} className="text-sm" />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Build the argument around the seven issues
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCorrectFacts} disabled={isCorrectingFacts || !generatedArgument}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Correct facts
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Draft</CardTitle>
                      {isLoadingLastVersion && <span className="text-xs text-slate-500">Loading last saved version…</span>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!generatedArgument && (
                      <p className="text-sm text-slate-500 py-8 text-center">No draft yet. Generate one from the facts above.</p>
                    )}
                    {generatedArgument?.full_argument_markdown && (
                      <DraftBody
                        text={generatedArgument.full_argument_markdown}
                        documents={documentPool}
                        className="prose prose-slate max-w-none bg-white p-4 rounded-lg border"
                      />
                    )}
                  </CardContent>
                </Card>

                <AICoach
                  factPattern={factPattern}
                  generatedArgument={generatedArgument}
                  currentMatter={currentMatter}
                  authorities={authorities}
                  position={position}
                  extracts={extracted.map((extract) => ({
                    authority: mainAuthority?.name || '',
                    citation: mainAuthority?.neutral_citation || '',
                    paragraph_ref: extract.paragraph_ref || '',
                    exact_text: extract.extract_text || '',
                    proposition: extract.proposition || '',
                    status: extract.status || ''
                  }))}
                />

                <ImproveActions actions={checklistProspects.actions} onAction={handleImproveAction} />
              </TabsContent>

              <TabsContent value="checks" className="space-y-4">
                <RegisterPanel
                  register={register}
                  record={record}
                  onAnswer={applyRegisterAnswer}
                  onUpload={() => document.getElementById('documents')?.click()}
                  onFixCitation={handleFixCitation}
                  onUseProposal={handleUseProposal}
                  onRerun={handleGenerate}
                  busy={isGenerating}
                  changes={draftChanges}
                  marks={draftMarks(generatedArgument?.full_argument_markdown || '')}
                />

                {generatedArgument?.full_argument_markdown && (
                  <>
                    <AuthorityCheckPanel
                      text={generatedArgument.full_argument_markdown}
                      extracts={extracted}
                      mainAuthorities={mainAuthority ? [mainAuthority] : mainAuthorityPool}
                    />
                    <DocumentCheckPanel
                      text={generatedArgument.full_argument_markdown}
                      documents={documentPool}
                      extracts={authorityExtracts}
                    />
                    <ExtractNeededPanel
                      text={generatedArgument.full_argument_markdown}
                      caseLaw={mainAuthorityPool}
                      record={record}
                      onSaved={() => queryClient.invalidateQueries({ queryKey: ['authorityExtracts'] })}
                    />
                  </>
                )}

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
              </TabsContent>

              <TabsContent value="questions" className="space-y-4">
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
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <p className="text-[11px] text-slate-500">{SAFETY_FOOTER}</p>
              <Button size="sm" variant="ghost" onClick={openRecordAt}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Go to the record
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}