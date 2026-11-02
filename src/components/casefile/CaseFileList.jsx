import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { CASE_FILE_CATEGORIES } from '@/lib/caseFile';

function partyStyle(party) {
  if (party === 'Ours') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (party === 'Other side') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (party === 'Court') return 'bg-slate-200 text-slate-800 border-slate-300';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function CaseFileList({ documents = [], onOpenFile, onRemove }) {
  return (
    <div className="space-y-4">
      {CASE_FILE_CATEGORIES.map((category) => {
        const rows = documents.filter((document) => (document.category || 'Other') === category);
        if (rows.length === 0) return null;
        return (
          <Card key={category} className="shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                {category} <span className="text-slate-400">({rows.length})</span>
              </h3>
              <div className="mt-3 space-y-2">
                {rows.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm text-slate-800">
                        <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="truncate">{document.file_name}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className={`border ${partyStyle(document.party)}`}>
                          {document.party || 'Party not recorded'}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {document.document_date || 'No date recorded'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Case no. {document.case_number || 'not recorded'}
                        </span>
                        <Badge
                          className={
                            (document.record_status || 'Filed or served') === 'Filed or served'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : document.record_status === 'Draft'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-purple-100 text-purple-800 border-purple-200'
                          }
                        >
                          {document.record_status || 'Filed or served'}
                        </Badge>
                        {!document.text && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            No text read
                          </Badge>
                        )}
                        {document.truncated && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">Truncated</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {document.file_uri && (
                        <Button size="icon" variant="ghost" onClick={() => onOpenFile(document.file_uri)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => onRemove(document)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}