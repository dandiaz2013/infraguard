import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Plus, FileText, Loader2 } from 'lucide-react';
import CaseFileUploadDialog from '@/components/casefile/CaseFileUploadDialog';
import CaseFileList from '@/components/casefile/CaseFileList';
import FoundElsewherePanel from '@/components/casefile/FoundElsewherePanel';

export default function CaseFileLibrary() {
  const [matterId, setMatterId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.list('-created_date', 50),
  });

  const { data: documents = [], isLoading } = useQuery({
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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['caseFileDocuments', matterId] });
    queryClient.invalidateQueries({ queryKey: ['legacyMatterFiles'] });
  };

  const remove = async (document) => {
    await base44.entities.CaseFileDocument.delete(document.id);
    refresh();
  };

  const openFile = async (fileUri) => {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri });
    window.open(signed_url, '_blank');
  };

  const filed = documents.filter((document) => (document.record_status || 'Filed or served') === 'Filed or served');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <FolderOpen className="h-7 w-7 text-slate-700" />
              Case File Library
            </h1>
            <p className="text-slate-600">
              The existing case file. This is the record every part of the app reads.
            </p>
          </div>
          <Link to="/DocumentGenerator" className="text-sm font-medium text-blue-700 hover:underline">
            Open generated drafts
          </Link>
        </div>

        <Card className="shadow-sm mb-6">
          <CardContent className="p-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px]">
              <p className="text-xs font-medium text-slate-600 mb-1">Matter</p>
              <Select value={matterId} onValueChange={setMatterId}>
                <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
                <SelectContent>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>{matter.matter_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setUploadOpen(true)} disabled={!matterId} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4 mr-2" />
              Add document
            </Button>
            {matterId && (
              <p className="text-xs text-slate-500">
                {documents.length} document{documents.length === 1 ? '' : 's'} in this case file, {filed.length} filed
                or served.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <FoundElsewherePanel matters={matters} />

          {!matterId && (
            <Card className="shadow-sm">
              <CardContent className="p-10 text-center text-slate-500">
                <FileText className="h-14 w-14 text-slate-300 mx-auto mb-3" />
                <p>Select a matter to open its case file.</p>
              </CardContent>
            </Card>
          )}

          {matterId && isLoading && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the case file...
            </p>
          )}

          {matterId && !isLoading && documents.length === 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-10 text-center text-slate-500">
                <p>Nothing in this case file yet. Add the judgments, orders and statements already filed or served.</p>
              </CardContent>
            </Card>
          )}

          {matterId && documents.length > 0 && (
            <CaseFileList documents={documents} onOpenFile={openFile} onRemove={remove} />
          )}
        </div>
      </div>

      <CaseFileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        matterId={matterId}
        onSaved={refresh}
      />
    </div>
  );
}