import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RECORD_STATUSES, FILED_BY_OPTIONS, ROLE_LABELS } from '@/lib/recordIndex';
import { CASE_FILE_CATEGORIES, PARTY_OPTIONS } from '@/lib/caseFile';
import { formatDate } from '@/lib/documentDate';

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
        What each document is, and who it comes from, is read from the document itself. Only judgments, orders and
        transcripts are the Court. Correct anything below.
      </p>

      {documents.map((doc) => (
        <div key={doc.id} className="border border-slate-200 rounded p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-800">{doc.name}</span>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
              {doc.category || 'Other'}
            </Badge>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
              {ROLE_LABELS[doc.role] || doc.role}
            </Badge>
            <span className="text-[11px] text-slate-500">{doc.segment_count} paragraphs indexed</span>
            {doc.doc_date && <span className="text-[11px] text-slate-500">Dated {formatDate(doc.doc_date)}</span>}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Type</label>
              <Select value={doc.category || 'Other'} onValueChange={(value) => onRecordChange(doc.id, { category: value })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_FILE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">From</label>
              <Select value={doc.party || 'Ours'} onValueChange={(value) => onRecordChange(doc.id, { party: value })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_OPTIONS.map((party) => (
                    <SelectItem key={party} value={party}>
                      {party}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Document date</label>
              <input
                type="date"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                value={doc.doc_date || ''}
                onChange={(event) => onRecordChange(doc.id, { document_date: event.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}