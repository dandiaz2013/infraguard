import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X } from 'lucide-react';

export default function ReferredDocsPanel({ missing = [], dismissed = [], onUpload, onDismiss }) {
  if (missing.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Every document the record refers to, with a date, a judge or a citation, is in the case file.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Documents the record refers to that are not uploaded. Only documents with a date, a judge, a case number or a
        neutral citation are listed.
      </p>
      {missing.map((doc) => {
        const gone = dismissed.includes(doc.id);
        return (
          <div key={doc.id} className="border border-slate-200 rounded p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{doc.label}</p>
                <p className="text-[11px] text-slate-600 truncate">
                  Referred to by {doc.document_name}, {doc.ref}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={gone ? 'bg-slate-100' : 'bg-red-50 text-red-800 border-red-200'}>
                  {gone ? 'Marked not needed' : doc.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={onUpload} disabled={gone}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Upload
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDismiss(doc.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {doc.quote && <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">“{doc.quote}”</p>}
          </div>
        );
      })}
    </div>
  );
}