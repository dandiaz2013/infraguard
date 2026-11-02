import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Scissors, Plus, Trash2, Upload } from 'lucide-react';
import { splitParagraphs, emptyExtractRow } from '@/lib/paragraphExtract';

export default function ExtractEditor({ rows, onChange, sourceFileUrl, onSourceChange }) {
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState('');
  const [isReading, setIsReading] = useState(false);

  const updateRow = (index, field, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));

  const applySplit = (text) => {
    if (!text.trim()) {
      setMessage('Paste or upload some text first.');
      return;
    }
    const blocks = splitParagraphs(text);
    if (blocks.length === 0) {
      setMessage('No paragraphs found in that text.');
      return;
    }
    onChange(blocks.map((block) => ({ ...block, proposition: '' })));
    setMessage(`Split into ${blocks.length} paragraph${blocks.length === 1 ? '' : 's'}. Check the numbers and text, then type what each one supports.`);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!/\.txt$/i.test(file.name)) {
      setMessage('Only plain .txt files are accepted here. No PDF or DOCX.');
      return;
    }

    setIsReading(true);
    setMessage('');
    try {
      const text = await file.text();
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      onSourceChange(file_uri);
      applySplit(text);
    } catch (error) {
      setMessage('Could not read that file.');
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Add paragraph extracts</h4>
        <span className="text-xs text-slate-500">Plain text only (.txt)</span>
      </div>

      <div>
        <Label htmlFor="extract-file" className="text-xs">Upload a .txt file</Label>
        <label
          htmlFor="extract-file"
          className="mt-1 flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
        >
          <Upload className="h-4 w-4" />
          {isReading ? 'Reading file...' : 'Choose a .txt file'}
        </label>
        <input
          id="extract-file"
          type="file"
          accept=".txt,text/plain"
          onChange={handleFile}
          disabled={isReading}
          className="hidden"
        />
        {sourceFileUrl && (
          <p className="text-xs text-green-700 mt-1">Source file stored privately.</p>
        )}
      </div>

      <div>
        <Label htmlFor="extract-paste" className="text-xs">Or paste the judgment text</Label>
        <Textarea
          id="extract-paste"
          rows={5}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder={'[12] The court must consider whether...\n\n13. A term will only be implied where...'}
          className="mt-1 text-sm bg-white"
        />
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => applySplit(pasted)}>
          <Scissors className="h-4 w-4 mr-2" />
          Split into paragraphs
        </Button>
      </div>

      {message && <p className="text-xs text-slate-700">{message}</p>}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-32">
                <Label className="text-[11px] uppercase tracking-wide text-slate-500">Paragraph</Label>
                <Input
                  value={row.paragraph_ref}
                  onChange={(event) => updateRow(index, 'paragraph_ref', event.target.value)}
                  placeholder="para 21"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto text-slate-400 hover:text-red-600"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wide text-slate-500">Exact text</Label>
              <Textarea
                rows={3}
                value={row.text}
                onChange={(event) => updateRow(index, 'text', event.target.value)}
                className="mt-1 text-sm font-mono"
              />
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wide text-slate-500">
                Proposition this paragraph supports
              </Label>
              <Input
                value={row.proposition}
                onChange={(event) => updateRow(index, 'proposition', event.target.value)}
                placeholder="One line: what we use this paragraph for"
                className="h-9 text-sm mt-1"
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, emptyExtractRow()])}>
        <Plus className="h-4 w-4 mr-2" />
        Add a paragraph by hand
      </Button>
    </div>
  );
}