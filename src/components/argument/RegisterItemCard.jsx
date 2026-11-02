import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { locateInRecord } from '@/lib/register';
import RegisterLawFields from '@/components/argument/RegisterLawFields';

const SEVERITY_STYLE = {
  High: 'bg-red-100 text-red-900 border-red-300',
  Medium: 'bg-amber-100 text-amber-900 border-amber-300',
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
};

const REMAINING_STYLE = {
  Closed: 'bg-green-100 text-green-900 border-green-300',
  Reduced: 'bg-sky-100 text-sky-900 border-sky-300',
  Unchanged: 'bg-amber-100 text-amber-900 border-amber-300',
  New: 'bg-red-100 text-red-900 border-red-300',
};

export default function RegisterItemCard({ item, record, onAnswer, onUpload, onFixCitation, onUseProposal }) {
  const answer = item.answer || {};
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState(answer.corrected_understanding || '');
  const [where, setWhere] = useState(false);
  const [official, setOfficial] = useState(item.type === 'law_date' && item.status === 'Needs official text');
  const [spot, setSpot] = useState({ document: answer.document_name || '', ref: answer.paragraph_ref || '', text: '' });
  const [located, setLocated] = useState(null);
  const [candidates, setCandidates] = useState(false);

  const locate = () => {
    const found = locateInRecord(record, { documentName: spot.document, ref: spot.ref, text: spot.text });
    setLocated(found || { notFound: true });
    if (found) {
      onAnswer({
        answer: 'Yes',
        document_name: found.document_name,
        paragraph_ref: found.ref,
        quote: found.quote,
        paste_text: spot.text,
        user_quote_verified: true,
      });
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={SEVERITY_STYLE[item.severity]}>{item.severity}</Badge>
        <span className="text-sm font-medium text-slate-900">{item.title}</span>
        <Badge variant="outline" className="ml-auto text-[10px]">{item.status}</Badge>
      </div>
      <p className="text-xs text-slate-600">{item.why} <span className="text-slate-400">Affects: {item.affects}.</span></p>

      <div className="border-t border-slate-100 pt-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">My understanding</h5>
        <p className="text-xs text-slate-800 mt-1">{item.understanding.text}</p>
        <p className="text-[10px] text-slate-500 mt-1">Source: {item.understanding.source}</p>
        {item.understanding.confirmed && !correcting && (
          <p className="text-[10px] text-green-700 mt-1">You confirmed this reading.</p>
        )}
        {correcting ? (
          <div className="mt-2 space-y-2">
            <Textarea rows={2} className="text-xs" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Say how it should be read" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onAnswer({ corrected_understanding: correction.trim() }); setCorrecting(false); }} disabled={!correction.trim()}>
                Save correction
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCorrecting(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => onAnswer({ understanding_ok: true })}>Yes, that's right</Button>
            <Button size="sm" variant="ghost" onClick={() => setCorrecting(true)}>No, correct it</Button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">What the record says</h5>
        {(item.evidence || []).length > 0 ? (
          <ul className="mt-1 space-y-2">
            {item.evidence.map((quote, index) => (
              <li key={index} className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded p-2">
                <span className="font-medium">{quote.document_name}, {quote.ref}</span>
                <span className="text-slate-500"> ({quote.role_label})</span>
                <p className="mt-1">“{quote.quote}”</p>
                <p className="text-[10px] text-slate-500 mt-1">{quote.because}</p>
              </li>
            ))}
          </ul>
        ) : item.type === 'attribution' ? (
          <p className="text-xs text-red-800 mt-1">{item.marker}</p>
        ) : (
          <p className="text-xs text-slate-600 mt-1">
            Nothing in the record answers this. Searched: {(item.record.searched || []).join('; ') || 'no documents uploaded'}
            {(item.record.discarded || 0) > 0 ? ` (${item.record.discarded} keyword match${item.record.discarded === 1 ? '' : 'es'} discarded - none answered the question)` : ''}.
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">One question</h5>
        <p className="text-xs font-medium text-slate-900 mt-1">{item.question}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button size="sm" variant={answer.answer === 'Yes' ? 'default' : 'outline'} onClick={() => { onAnswer({ answer: 'Yes' }); setWhere(true); }}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Yes
          </Button>
          <Button size="sm" variant={answer.answer === 'No' ? 'default' : 'outline'} onClick={() => { onAnswer({ answer: 'No' }); setWhere(true); }}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> No
          </Button>
          <Button size="sm" variant={answer.answer === 'Not sure' ? 'default' : 'outline'} onClick={() => { onAnswer({ answer: 'Not sure' }); setCandidates(true); }}>
            Not sure
          </Button>
        </div>

        {where && (
          <div className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded p-2">
            <p className="text-[11px] text-slate-700">
              {answer.answer === 'Yes' ? 'Where is it? Give the document and paragraph, or paste the wording.' : 'Tell me why, paste the paragraphs, or point me to where the answer is.'}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[10px]">Document</Label>
                <Input className="text-xs" value={spot.document} onChange={(e) => setSpot({ ...spot, document: e.target.value })} placeholder="Document name" />
              </div>
              <div>
                <Label className="text-[10px]">Paragraph, page or lines</Label>
                <Input className="text-xs" value={spot.ref} onChange={(e) => setSpot({ ...spot, ref: e.target.value })} placeholder="para 35" />
              </div>
            </div>
            <Textarea rows={2} className="text-xs" value={spot.text} onChange={(e) => setSpot({ ...spot, text: e.target.value })} placeholder="Or paste the paragraph" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={locate} disabled={!spot.document && !spot.text}>Search that spot and the record</Button>
              {!answer.answer && <Button size="sm" variant="ghost" onClick={() => setCandidates(true)}>Show candidates</Button>}
            </div>
            {located && located.notFound && (
              <p className="text-[11px] text-red-800">
                I could not find that in the record. Check the document name and the paragraph number, or paste the wording exactly as it appears.
              </p>
            )}
            {located && !located.notFound && (
              <div className="text-[11px] text-slate-800 bg-white border border-green-300 rounded p-2">
                <p className="font-medium">Found at {located.document_name}, {located.ref} (verified in code):</p>
                <p className="mt-1">“{located.quote}”</p>
              </div>
            )}
            <Textarea rows={2} className="text-xs" value={answer.user_note || ''} onChange={(e) => onAnswer({ user_note: e.target.value })} placeholder="Your explanation (recorded as your answer, not as record evidence)" />
          </div>
        )}

        {candidates && (
          <div className="mt-2 space-y-1 border border-slate-200 rounded p-2">
            <p className="text-[11px] text-slate-700">Closest paragraphs in the record. Pick one, or say none of these.</p>
            {((item.record.candidates || []).length === 0) && <p className="text-[11px] text-slate-500">No candidates found.</p>}
            {(item.record.candidates || []).map((candidate, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onAnswer({ answer: 'Yes', document_name: candidate.document_name, paragraph_ref: candidate.ref, quote: candidate.quote, user_quote_verified: true })}
                className="block w-full text-left text-[11px] bg-white border border-slate-200 rounded p-1.5 hover:border-blue-400"
              >
                <span className="font-medium">{candidate.document_name}, {candidate.ref}</span> — “{candidate.quote.slice(0, 160)}”
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => { onAnswer({ answer: 'No' }); setCandidates(false); }}>None of these</Button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">How to resolve</h5>
        <div className="flex flex-wrap gap-2 mt-1">
          {(item.steps || []).map((step) => (
            <Button
              key={step.action}
              size="sm"
              variant="outline"
              onClick={() => {
                if (step.action === 'upload') onUpload(item);
                else if (step.action === 'official') setOfficial(true);
                else if (step.action === 'paste') setWhere(true);
                else if (step.action === 'accept') onAnswer({ accepted: true });
                else if (step.action === 'counsel') onAnswer({ user_note: `${answer.user_note ? `${answer.user_note} ` : ''}Counsel to advise on this point.` });
                else if (step.action === 'fixcitation') onFixCitation(item);
                else if (step.action === 'useproposal') onUseProposal(item);
              }}
            >
              {step.label}
            </Button>
          ))}
        </div>
        {official && (
          <div className="mt-2">
            <RegisterLawFields value={answer} onSave={(form) => onAnswer(form)} />
          </div>
        )}
        {(item.type === 'proposal' && item.proposal) && (
          <div className="mt-2 text-[11px] text-slate-800 bg-slate-50 border border-slate-200 rounded p-2 whitespace-pre-wrap">
            {item.proposal.proposed || 'Nothing in the record to build this from yet.'}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Result</h5>
        <div className="text-[11px] text-slate-800 space-y-1 mt-1">
          <p><span className="text-slate-500">Original risk:</span> {item.original}</p>
          <p>
            <span className="text-slate-500">Evidence found:</span>{' '}
            {(item.evidence || []).length > 0
              ? item.evidence.map((quote) => `${quote.document_name}, ${quote.ref}`).join('; ')
              : 'none'}
          </p>
          <p>
            <span className="text-slate-500">Status:</span> {item.status}{' '}
            <Badge variant="outline" className={REMAINING_STYLE[item.remaining]}>{item.remaining}</Badge>
          </p>
          <p><span className="text-slate-500">Remaining risk:</span> {item.reason}</p>
        </div>
      </div>
    </div>
  );
}