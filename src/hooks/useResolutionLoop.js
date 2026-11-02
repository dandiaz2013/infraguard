// The resolution loop, wired once. Builds the register, keeps the panels filled from the
// record, and stores the user's answers against each item.
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { buildChronology } from '@/lib/chronology';
import { detectMissingDocuments } from '@/lib/missingDocs';
import { positionLines } from '@/lib/noteClassify';
import { runAutoFill } from '@/lib/autoFill';
import { buildRegister } from '@/lib/register';
import { checkQuoteSources } from '@/lib/sourceAttribution';
import { compareDraft } from '@/lib/draftChanges';

export default function useResolutionLoop({
  matterId, record, checklist, checklistKey, legalTests = [], registerAnswers = [],
  undisputedFacts = '', generatedArgument = null,
  pendingProposals, setPendingProposals,
  materials, setters, setGeneratedArgument,
}) {
  const queryClient = useQueryClient();
  const [fillNote, setFillNote] = React.useState('');
  const [draftChanges, setDraftChanges] = React.useState([]);

  const chronology = React.useMemo(() => buildChronology(record), [record]);
  const missingDocs = React.useMemo(() => detectMissingDocuments(record), [record]);
  const positionNotes = React.useMemo(() => positionLines(undisputedFacts), [undisputedFacts]);
  const citations = React.useMemo(
    () => (generatedArgument?.full_argument_markdown ? checkQuoteSources(generatedArgument.full_argument_markdown, record) : []),
    [generatedArgument, record]
  );
  const answers = React.useMemo(
    () => Object.fromEntries(registerAnswers.map((entry) => [entry.item_id, entry])),
    [registerAnswers]
  );

  const register = React.useMemo(
    () =>
      buildRegister({
        checklist,
        record,
        tests: legalTests,
        missingDocs,
        positionNotes,
        proposals: pendingProposals,
        citations,
        chronology,
        answers,
      }),
    [checklistKey, record, legalTests, missingDocs, positionNotes, pendingProposals, citations, chronology, answers]
  );

  const applyProposal = (proposal) => {
    if (!proposal) return;
    if (proposal.field === 'factPattern') setters.setFactPattern(proposal.proposed);
    else if (proposal.field === 'chronology') setters.setChronology(proposal.proposed);
    else if (proposal.field === 'lossHarmRisk') setters.setLossHarmRisk(proposal.proposed);
  };

  const applyAutoFill = async () => {
    if (!matterId) return;
    if (!record || record.is_empty) {
      setFillNote('No document text in the record yet. Upload the filed papers and the material fills itself.');
      return;
    }

    const result = runAutoFill({
      record,
      ourPoints: materials.ourPoints,
      clauses: materials.clauses,
      misstatements: materials.misstatements,
      tests: legalTests,
      factPattern: materials.factPattern,
      chronology: materials.chronology,
      lossHarmRisk: materials.lossHarmRisk,
      chronologyText: chronology.text,
    });

    if (result.ourPoints) setters.setOurPoints(result.ourPoints);
    if (result.clauses) setters.setClauses(result.clauses);
    if (result.misstatements) setters.setMisstatements(result.misstatements);
    if (result.proposals.length) {
      setPendingProposals(result.proposals);
      result.proposals.forEach(applyProposal);
    }

    if (result.tests.length) {
      await Promise.all(
        result.tests.map((test) =>
          base44.entities.LegalTest.create({
            matter_id: matterId,
            name: test.name,
            elements: test.elements,
            notes: test.notes,
            status: 'Proposed',
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['legalTests', matterId] });
    }

    setFillNote(
      result.added > 0 || result.proposals.length > 0
        ? `Filled ${result.added} item${result.added === 1 ? '' : 's'} from the record${
            result.proposals.length ? ' and proposed the placeholder fields' : ''
          }.`
        : 'Nothing to fill - every panel already holds material from the record.'
    );
  };

  const signature = (record?.documents || []).map((doc) => `${doc.id}:${doc.segment_count}`).join('|');

  React.useEffect(() => {
    if (!matterId || !signature) return;
    applyAutoFill();
  }, [matterId, signature]);

  const saveAnswer = async (item, patch) => {
    const existing = answers[item.id];
    const payload = { ...patch, item_type: item.type, checked_at: new Date().toISOString() };
    if (existing) await base44.entities.RegisterAnswer.update(existing.id, payload);
    else await base44.entities.RegisterAnswer.create({ matter_id: matterId, item_id: item.id, ...payload });
    queryClient.invalidateQueries({ queryKey: ['registerAnswers', matterId] });
  };

  const useProposal = (item) => {
    applyProposal(item.proposal);
    setPendingProposals(pendingProposals.filter((proposal) => proposal.field !== item.proposal?.field));
    saveAnswer(item, { answer: 'Yes', understanding_ok: true });
  };

  const fixCitation = (item) => {
    const text = generatedArgument?.full_argument_markdown || '';
    if (!item.fix?.find || !text.includes(item.fix.find)) {
      alert('The draft no longer contains that citation. Generate the draft again and check.');
      return;
    }
    setGeneratedArgument({ full_argument_markdown: text.replace(item.fix.find, item.fix.replace) });
    saveAnswer(item, { answer: 'Yes' });
  };

  return {
    register,
    chronology,
    missingDocs,
    citations,
    fillNote,
    draftChanges,
    setDraftChanges,
    applyAutoFill,
    applyRegisterAnswer: saveAnswer,
    useProposal,
    fixCitation,
    compare: (text) => compareDraft(text, register.items),
  };
}