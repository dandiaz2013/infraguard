import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Upload } from 'lucide-react';
import fileToBase64 from '@/lib/fileToBase64';
import { CASE_FILE_CATEGORIES, PARTY_OPTIONS, RECORD_STATUSES } from '@/lib/caseFile';
import { classifyDocument, detectParty } from '@/lib/documentType';
import { detectDocumentDate, detectedLabel, formatDate } from '@/lib/documentDate';

const MAX_TEXT = 120000;

export default function CaseFileUploadDialog({ open, onOpenChange, matterId, onSaved, ourSide = '' }) {
  const [category, setCategory] = useState('Auto detect');
  const [recordStatus, setRecordStatus] = useState('Filed or served');
  const [caseNumber, setCaseNumber] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setRows([]);
    setError('');
  };

  const patchRow = (key, changes) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0 || !matterId) return;
    setBusy(true);
    setError('');
    try {
      const read = [];
      for (const file of files) {
        const fileBase64 = await fileToBase64(file);
        const response = await base44.functions.invoke('documentTextExtract', {
          fileName: file.name,
          fileBase64,
        });
        if (response.data?.error) throw new Error(response.data.error);
        const text = response.data?.text || '';
        const verdict = classifyDocument({ file_name: file.name, text });
        const detection = detectDocumentDate(text, verdict.category);
        const party = detectParty({ text, category: verdict.category, our_side: ourSide });
        read.push({
          key: `${file.name}-${read.length}`,
          file_name: file.name,
          text: text.slice(0, MAX_TEXT),
          char_count: text.length,
          truncated: text.length > MAX_TEXT,
          file_uri: response.data?.file_uri || '',
          detected_category: verdict.category,
          party_suggested: party.party,
          party_reason: party.reason,
          party: party.party || '',
          party_confirmed: Boolean(party.party) && party.party !== '',
          detection,
          date: detection.date,
          date_confirmed: false,
        });
      }
      setRows(read);
    } catch (err) {
      setError(err.message || 'That document could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!rows.length) return;
    setBusy(true);
    setError('');
    try {
      for (const row of rows) {
        const finalCategory = category === 'Auto detect' ? row.detected_category : category;
        await base44.entities.CaseFileDocument.create({
          matter_id: matterId,
          file_name: row.file_name,
          category: finalCategory,
          party: row.party || undefined,
          party_confirmed: row.party_confirmed,
          party_reason: row.party_reason,
          document_date: row.date || undefined,
          detected_date: row.detection.date,
          confirmed_date: row.date || '',
          date_confirmed: row.date_confirmed,
          case_number: caseNumber.trim(),
          record_status: recordStatus,
          file_uri: row.file_uri,
          text: row.text,
          char_count: row.char_count,
          truncated: row.truncated,
          source: 'Case File Library upload',
        });
      }
      await onSaved();
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'That document could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((row) => !row.date_confirmed || !row.party).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
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
                  <SelectItem value="Auto detect">Auto detect</SelectItem>
                  {CASE_FILE_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status in the record</Label>
              <Select value={recordStatus} onValueChange={setRecordStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECORD_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Case or claim number</Label>
              <Input value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} placeholder="Optional" />
            </div>
          </div>

          {rows.length === 0 && (
            <p className="text-sm text-slate-600">
              Choose the files. Each one is read first, then you confirm the date and which side it comes from
              before anything is saved.
            </p>
          )}

          {rows.map((row) => (
            <div key={row.key} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{row.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {category === 'Auto detect' ? row.detected_category : category} · {row.char_count.toLocaleString()} characters
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.date_confirmed ? (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      <Check className="mr-1 h-3 w-3" /> Date confirmed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      Date not confirmed
                    </Badge>
                  )}
                  {row.party ? (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      <Check className="mr-1 h-3 w-3" /> {row.party}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      Party not confirmed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-600">{detectedLabel(row.detection)}</p>
                  <div className="mt-1 flex gap-2">
                    <Input
                      type="date"
                      value={row.date}
                      onChange={(event) =>
                        patchRow(row.key, { date: event.target.value, date_confirmed: Boolean(event.target.value) })
                      }
                    />
                    {!row.date_confirmed && row.date && (
                      <Button size="sm" variant="outline" onClick={() => patchRow(row.key, { date_confirmed: true })}>
                        Confirm
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-600">{row.party_reason}</p>
                  <div className="mt-1 flex gap-2">
                    <Select
                      value={row.party || 'unset'}
                      onValueChange={(value) =>
                        patchRow(row.key, {
                          party: value === 'unset' ? '' : value,
                          party_confirmed: value !== 'unset',
                        })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Confirm the side" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">Not confirmed</SelectItem>
                        {PARTY_OPTIONS.map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <p className="text-xs text-slate-500">
            Files are stored privately. A detected date is never used for promptness until you confirm it.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? 'Reading...' : rows.length ? 'Add more files' : 'Choose files'}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                readFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          <Button onClick={save} disabled={!rows.length || busy}>
            {busy ? 'Saving...' : `Add ${rows.length || ''} to the case file`}
          </Button>
        </DialogFooter>
        {pending > 0 && rows.length > 0 && (
          <p className="text-xs text-amber-700">
            {pending} document{pending === 1 ? '' : 's'} still need a confirmed date or side. You can add them now and
            confirm later, but promptness will not use an unconfirmed date.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}