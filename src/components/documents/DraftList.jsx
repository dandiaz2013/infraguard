import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FolderPlus, FileText } from 'lucide-react';

const CATEGORY_BY_TYPE = {
  'Witness Statement': 'Witness statements',
  'Skeleton Argument': 'Skeleton arguments',
};

const today = () => new Date().toISOString().slice(0, 10);

// Generated drafts are not the record. They only join the case file when the
// user says the draft has been filed or served.
export default function DraftList({ matterId }) {
  const queryClient = useQueryClient();
  const [dates, setDates] = useState({});
  const [busy, setBusy] = useState('');

  const { data: drafts = [] } = useQuery({
    queryKey: ['documents', matterId],
    queryFn: async () => {
      const page = await base44.entities.Document.filter(
        { matter_id: matterId },
        { sort: '-updated_date', limit: 30 }
      );
      return page.items || [];
    },
    enabled: !!matterId,
  });

  const { data: caseFile = [] } = useQuery({
    queryKey: ['caseFileDocuments', matterId],
    queryFn: async () => {
      const page = await base44.entities.CaseFileDocument.filter(
        { matter_id: matterId },
        { sort: '-created_date', limit: 200 }
      );
      return page.items || [];
    },
    enabled: !!matterId,
  });

  const alreadyIn = (draftId) => caseFile.some((document) => document.origin_id === draftId);

  const addToCaseFile = async (draft) => {
    setBusy(draft.id);
    try {
      const filedDate = dates[draft.id] || today();
      await base44.entities.CaseFileDocument.create({
        matter_id: matterId,
        file_name: `${draft.title}.md`,
        category: CATEGORY_BY_TYPE[draft.document_type] || 'Other',
        party: 'Ours',
        document_date: filedDate,
        record_status: 'Filed or served',
        text: draft.content || '',
        char_count: (draft.content || '').length,
        source: 'Generated draft',
        origin_id: draft.id,
      });
      await base44.entities.Document.update(draft.id, { status: 'Filed' });
      queryClient.invalidateQueries({ queryKey: ['caseFileDocuments', matterId] });
      queryClient.invalidateQueries({ queryKey: ['documents', matterId] });
    } finally {
      setBusy('');
    }
  };

  if (!matterId || drafts.length === 0) return null;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-slate-700" />
          Saved drafts for this matter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-slate-500">
          A draft is not part of the record. Once it is filed or served, add it to the Case File Library.
        </p>
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-800 truncate">{draft.title}</p>
              <p className="text-[11px] text-slate-500">
                {draft.document_type} · {draft.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {alreadyIn(draft.id) ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">In the case file</Badge>
              ) : (
                <>
                  <Input
                    type="date"
                    className="h-8 w-36"
                    value={dates[draft.id] || today()}
                    onChange={(event) => setDates({ ...dates, [draft.id]: event.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addToCaseFile(draft)}
                    disabled={busy === draft.id}
                  >
                    <FolderPlus className="h-4 w-4 mr-1" />
                    Add to Case File Library
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}