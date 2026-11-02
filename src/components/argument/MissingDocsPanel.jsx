import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileWarning, Upload } from 'lucide-react';

export default function MissingDocsPanel({ missing = [], onUpload }) {
  if (missing.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-amber-700" />
          Referred to but not uploaded
        </h4>
        <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-900">{missing.length}</Badge>
      </div>
      <ul className="space-y-2">
        {missing.map((doc) => (
          <li key={doc.id} className="border border-amber-200 bg-amber-50 rounded p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-amber-900">{doc.label}</span>
              <Badge variant="outline" className="text-[10px]">Blocked: upload {doc.label}</Badge>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => onUpload(doc)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
            </div>
            <p className="text-[11px] text-amber-900 mt-1">
              {doc.who_label} refers to it at {doc.document_name}, {doc.ref}: “{doc.quote}”
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}