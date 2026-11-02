import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import fileToBase64 from '@/lib/fileToBase64';

const MAX_TEXT = 120000;

const CATEGORIES = [
  { value: 'Case summary and pleadings', hint: 'Our case summary, particulars of claim or defence' },
  { value: 'Our witness statement', hint: 'Statements served on our side' },
  { value: 'Other party witness statement', hint: 'Statements served by the other party' },
  { value: 'N244 and continuation sheet', hint: 'The application and its continuation sheet' },
  { value: 'Previous judgments and orders', hint: 'Orders and judgments already made in this matter' },
  { value: 'Other document', hint: 'Anything else that belongs in the bundle' },
];

export default function StepUpload({ matter, files, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const upload = async (category, fileList) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(category);
    setError('');
    try {
      for (const file of Array.from(fileList)) {
        const fileBase64 = await fileToBase64(file);
        const response = await base44.functions.invoke('documentTextExtract', {
          fileName: file.name,
          fileBase64,
        });
        if (response.data?.error) throw new Error(response.data.error);
        const text = response.data?.text || '';
        await base44.entities.MatterFile.create({
          matter_id: matter.id,
          file_name: file.name,
          category,
          file_uri: response.data?.file_uri || '',
          text: text.slice(0, MAX_TEXT),
          char_count: text.length,
          truncated: text.length > MAX_TEXT,
        });
      }
      await onChanged();
    } catch (err) {
      setError(err.message || 'That document could not be read.');
    } finally {
      setBusy('');
    }
  };

  const remove = async (id) => {
    await base44.entities.MatterFile.delete(id);
    await onChanged();
  };

  const openFile = async (fileUri) => {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri });
    window.open(signed_url, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm text-slate-600">
            Upload the bundle for this matter. Text is read from each document once, and every later step uses
            only these documents.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {files.length} document{files.length === 1 ? '' : 's'} in the bundle.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => {
          const categoryFiles = files.filter((file) => file.category === category.value);
          return (
            <Card key={category.value} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{category.value}</h3>
                    <p className="text-xs text-slate-500 mt-1">{category.hint}</p>
                  </div>
                  <label
                    className={`inline-flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                      busy ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    {busy === category.value ? 'Reading...' : 'Upload'}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        upload(category.value, event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="mt-3 space-y-2">
                  {categoryFiles.length === 0 ? (
                    <p className="text-xs text-slate-400">Nothing uploaded yet.</p>
                  ) : (
                    categoryFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm text-slate-800">
                            <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{file.file_name}</span>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {(file.char_count || 0).toLocaleString()} characters
                            </span>
                            {!file.text && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                No text read
                              </Badge>
                            )}
                            {file.truncated && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">Truncated</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {file.file_uri && (
                            <Button size="icon" variant="ghost" onClick={() => openFile(file.file_uri)}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => remove(file.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}