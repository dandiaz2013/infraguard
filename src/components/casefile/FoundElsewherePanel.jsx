import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FolderInput } from 'lucide-react';
import { legacyCategory, legacyParty } from '@/lib/caseFile';

// Step: move uploads already sitting elsewhere in the account into the case file.
export default function FoundElsewherePanel({ matters = [] }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const { data: legacyFiles = [] } = useQuery({
    queryKey: ['legacyMatterFiles'],
    queryFn: async () => {
      const page = await base44.entities.MatterFile.list('-created_date', 200);
      return Array.isArray(page) ? page : page.items || [];
    },
  });

  const matterName = (id) => matters.find((matter) => matter.id === id)?.matter_name || 'Matter not named';

  const move = async () => {
    setBusy(true);
    setNote('');
    try {
      for (const file of legacyFiles) {
        await base44.entities.CaseFileDocument.create({
          matter_id: file.matter_id,
          file_name: file.file_name,
          category: legacyCategory(file.file_name, file.category),
          party: legacyParty(file),
          document_date: file.filed_date || undefined,
          case_number: '',
          record_status: file.record_status || 'Filed or served',
          file_uri: file.file_uri || '',
          text: file.text || '',
          char_count: file.char_count || (file.text || '').length,
          truncated: file.truncated === true,
          exhibit_of: file.exhibit_of || '',
          source: 'Found elsewhere in your account',
          origin_id: file.id,
        });
        await base44.entities.MatterFile.delete(file.id);
      }
      setNote(`${legacyFiles.length} document${legacyFiles.length === 1 ? '' : 's'} moved into the Case File Library.`);
      queryClient.invalidateQueries({ queryKey: ['legacyMatterFiles'] });
      queryClient.invalidateQueries({ queryKey: ['caseFileDocuments'] });
    } catch (error) {
      setNote(error.message || 'Those documents could not be moved.');
    } finally {
      setBusy(false);
    }
  };

  if (legacyFiles.length === 0) return null;

  return (
    <Card className="shadow-sm border-l-4 border-l-amber-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderInput className="h-5 w-5 text-amber-600" />
          Found elsewhere in your account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">
          {legacyFiles.length} document{legacyFiles.length === 1 ? '' : 's'} uploaded in the Argument Builder,
          the Judgment Analyzer or a matter upload {legacyFiles.length === 1 ? 'is' : 'are'} not in the case file
          yet. Nothing in the app treats {legacyFiles.length === 1 ? 'it' : 'them'} as the record until you move
          {legacyFiles.length === 1 ? ' it' : ' them'} across.
        </p>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {legacyFiles.map((file) => (
            <p key={file.id} className="text-xs text-slate-600">
              {file.file_name} <span className="text-slate-400">- {matterName(file.matter_id)}</span>
            </p>
          ))}
        </div>
        {note && <p className="text-xs text-slate-700">{note}</p>}
        <Button onClick={move} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderInput className="h-4 w-4 mr-2" />}
          Move {legacyFiles.length} document{legacyFiles.length === 1 ? '' : 's'} into the Case File Library
        </Button>
      </CardContent>
    </Card>
  );
}