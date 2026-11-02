import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, RECORD_STATUSES, FILED_BY_OPTIONS } from '@/lib/recordIndex';

export default function RecordDocumentsPanel({ documents = [], onRecordChange }) {
  if (documents.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Upload the case papers first. Filed or served documents become the record for this matter.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Filed or served documents are the record: authoritative on what was said, argued, evidenced and ruled, never on
        what the law is.
      </p>

      {documents.map((doc) => (
        <div key={doc.id} className="border border-slate-200 rounded p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-800">{doc.name}</span>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
              {ROLE_LABELS[doc.role] || doc.role}
            </Badge>
            <span className="text-[11px] text-slate-500">
              {doc.segment_count} reference{doc.segment_count === 1 ? '' : 's'} indexed
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Record status</label>
              <Select
                value={doc.record_status || 'Filed or served'}
                onValueChange={(value) => onRecordChange(doc.id, { record_status: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Filed by</label>
              <Select
                value={doc.filed_by || ''}
                onValueChange={(value) => onRecordChange(doc.id, { filed_by: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Not recorded" />
                </SelectTrigger>
                <SelectContent>
                  {FILED_BY_OPTIONS.map((party) => (
                    <SelectItem key={party} value={party}>
                      {party}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Filed / served date</label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={doc.filed_date || ''}
                onChange={(event) => onRecordChange(doc.id, { filed_date: event.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Exhibit to</label>
              <Select
                value={doc.exhibit_of || ''}
                onValueChange={(value) => onRecordChange(doc.id, { exhibit_of: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Not an exhibit" />
                </SelectTrigger>
                <SelectContent>
                  {documents
                    .filter((parent) => parent.id !== doc.id)
                    .map((parent) => (
                      <SelectItem key={parent.id} value={parent.name}>
                        {parent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}