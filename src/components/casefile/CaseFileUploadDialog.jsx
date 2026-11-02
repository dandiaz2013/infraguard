import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import fileToBase64 from '@/lib/fileToBase64';
import { CASE_FILE_CATEGORIES, PARTY_OPTIONS, RECORD_STATUSES } from '@/lib/caseFile';

const MAX_TEXT = 120000;

export default function CaseFileUploadDialog({ open, onOpenChange, matterId, onSaved }) {
  const [category, setCategory] = useState('Judgments');
  const [party, setParty] = useState('Court');
  const [documentDate, setDocumentDate] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [recordStatus, setRecordStatus] = useState('Filed or served');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0 || !matterId) return;
    setBusy(true);
    setError('');
    try {
      for (const file of files) {
        const fileBase64 = await fileToBase64(file);
        const response = await base44.functions.invoke('documentTextExtract', {
          fileName: file.name,
          fileBase64,
        });
        if (response.data?.error) throw new Error(response.data.error);
        const text = response.data?.text || '';
        await base44.entities.CaseFileDocument.create({
          matter_id: matterId,
          file_name: file.name,
          category,
          party,
          document_date: documentDate || undefined,
          case_number: caseNumber.trim(),
          record_status: recordStatus,
          file_uri: response.data?.file_uri || '',
          text: text.slice(0, MAX_TEXT),
          char_count: text.length,
          truncated: text.length > MAX_TEXT,
          source: 'Case File Library upload',
        });
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'That document could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to the Case File Library</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CASE_FILE_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Party</Label>
              <Select value={party} onValueChange={setParty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTY_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </div>
            <div>
              <Label>Case or claim number</Label>
              <Input value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={recordStatus} onValueChange={setRecordStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECORD_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <p className="text-xs text-slate-500">
            Files are stored privately. The text is read once and every later step uses only the case file.
          </p>
        </div>
        <DialogFooter>
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? 'Reading...' : 'Choose files'}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                upload(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}