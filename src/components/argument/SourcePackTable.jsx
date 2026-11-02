import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { sourcePackText } from '@/lib/docReferences';

export default function SourcePackTable({ rows = [], title = 'Source pack' }) {
  const [copied, setCopied] = useState('');

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch (error) {
      setCopied('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-xs uppercase tracking-wide text-slate-500">{title}</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy('all', rows.map((row) => `${row.document_name} ${row.reference}: ${row.text}`).join('\n'))}
            disabled={rows.length === 0}
          >
            {copied === 'all' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            Copy all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy('pack', sourcePackText(rows))}
            disabled={rows.length === 0}
          >
            {copied === 'pack' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            Copy source pack
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No resolved document references yet.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 px-3">Document</th>
                <th className="py-2 px-3">Paragraph/page</th>
                <th className="py-2 px-3">Exact text</th>
                <th className="py-2 px-3">Used in</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.label}-${index}`} className="border-t border-slate-100 align-top">
                  <td className="py-2 px-3 text-slate-800">{row.document_name}</td>
                  <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{row.reference}</td>
                  <td className="py-2 px-3 text-slate-700 max-w-md">{row.text}</td>
                  <td className="py-2 px-3 text-slate-500">{row.used_in}</td>
                  <td className="py-2 px-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => copy(row.label + index, row.text)}>
                      {copied === row.label + index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}