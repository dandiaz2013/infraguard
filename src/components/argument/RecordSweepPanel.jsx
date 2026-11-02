import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, Gavel, History, Paperclip } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/recordIndex';

const ROLE_ORDER = [
  ['Court', 'Judge says'],
  ['Other party', 'Other side says'],
  ['Our side', 'Our statements say'],
  ['Unknown', 'Party not recorded'],
];

function Section({ icon: Icon, title, count, children }) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {typeof count === 'number' && <span className="text-slate-400">({count})</span>}
      </h4>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

export default function RecordSweepPanel({ sweeps, onUseClause }) {
  if (!sweeps) return null;
  const { dates_and_law: laws = [], court_found: findings = [], already_argued: argued = [], exhibits = [] } = sweeps;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Sweeps run over the whole record: {laws.length} provision{laws.length === 1 ? '' : 's'} and rule
        {laws.length === 1 ? '' : 's'} mentioned, {findings.length} finding{findings.length === 1 ? '' : 's'},{' '}
        {exhibits.length} text{exhibits.length === 1 ? '' : 's'} that can be taken from an exhibit.
      </p>

      <Section icon={CalendarClock} title="Dates and law" count={laws.length}>
        {laws.length === 0 ? (
          <Empty>No statute, regulation, CPR rule or practice direction is mentioned in the record.</Empty>
        ) : (
          <div className="space-y-3">
            {laws.map((law) => (
              <div key={law.label} className="border border-slate-200 rounded p-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-800">{law.label}</span>
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                    {law.kind}
                  </Badge>
                  {law.dates.length > 0 && (
                    <span className="text-[11px] text-slate-600">Dates in the record: {law.dates.join(', ')}</span>
                  )}
                </div>

                {ROLE_ORDER.map(([role, label]) => {
                  const rows = law.timeline.filter((row) => row.role === role);
                  if (rows.length === 0) return null;
                  return (
                    <div key={role}>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                      {rows.slice(0, 4).map((row, index) => (
                        <p key={index} className="text-[11px] text-slate-700">
                          {row.document_name}, {row.ref} — “{row.quote}”
                        </p>
                      ))}
                    </div>
                  );
                })}

                {law.in_force.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">In force / replaced / revoked</p>
                    {law.in_force.slice(0, 4).map((row, index) => (
                      <p key={index} className="text-[11px] text-slate-700">
                        {ROLE_LABELS[row.role] || row.role} — {row.document_name}, {row.ref} — “{row.quote}”
                      </p>
                    ))}
                  </div>
                )}

                {law.flags.map((flag, index) => (
                  <p key={index} className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
                    Date comparison in the record: {flag}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Gavel} title="What the court found" count={findings.length}>
        {findings.length === 0 ? (
          <Empty>No judgment, order or transcript in the record states a finding or ruling.</Empty>
        ) : (
          <ul className="space-y-1">
            {findings.map((row, index) => (
              <li key={index} className="text-[11px] text-slate-700">
                <span className="font-medium">
                  {row.document_name}, {row.ref}
                </span>{' '}
                — “{row.quote}”
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={History} title="What was already argued" count={argued.length}>
        {argued.length === 0 ? (
          <Empty>Record Our points in the case material panel and the record will be searched for each one.</Empty>
        ) : (
          <ul className="space-y-2">
            {argued.map((row, index) => (
              <li key={index} className="text-[11px] text-slate-700">
                <p className="font-medium text-slate-800">{row.point || 'Point with no text'}</p>
                {row.raised.length === 0 ? (
                  <p className="text-amber-800">Not found anywhere in the record.</p>
                ) : (
                  <p>
                    Raised in:{' '}
                    {row.raised.map((hit) => `${hit.document_name}, ${hit.ref}`).join(' · ')}
                  </p>
                )}
                {row.addressed.length > 0 && (
                  <p>
                    Addressed by:{' '}
                    {row.addressed
                      .map((hit) => `${ROLE_LABELS[hit.role] || hit.role} — ${hit.document_name}, ${hit.ref}`)
                      .join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Paperclip} title="Rule and clause text in the record" count={exhibits.length}>
        {exhibits.length === 0 ? (
          <Empty>No statute, regulation or rule text appears in the record yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {exhibits.slice(0, 12).map((row, index) => (
              <li key={index} className="border border-slate-200 rounded p-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-800">{row.reference}</span>
                  <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
                    {row.note}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-700">
                  {row.document_name}, {row.paragraph_ref} — “{row.text}”
                </p>
                {onUseClause && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onUseClause(row)}>
                    Use as clause text
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}