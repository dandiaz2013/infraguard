import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function ParseReviewTable({ candidates, onConfirm, onCancel, isSaving }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setRows(candidates.map((candidate) => ({ ...candidate, selected: true })));
  }, [candidates]);

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const selectedCount = rows.filter((row) => row.selected).length;

  const handleConfirm = () => {
    const payload = rows
      .filter((row) => row.selected)
      .map(({ selected, ...rest }) => rest);
    onConfirm(payload);
  };

  return (
    <Card className="shadow-sm border-l-4 border-l-amber-500">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">Review extracted citations</h3>
            <p className="text-sm text-slate-600">
              {rows.length} candidate{rows.length === 1 ? '' : 's'} found. Untick anything that is not a case, and correct any
              names or citations before saving.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={isSaving || selectedCount === 0}>
              {isSaving ? 'Saving...' : `Confirm ${selectedCount}`}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2 w-10">Keep</th>
                <th className="py-2 pr-2">Case name</th>
                <th className="py-2 pr-2">Neutral citation</th>
                <th className="py-2 pr-2">Paragraph</th>
                <th className="py-2">Context</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-2">
                    <Checkbox
                      checked={row.selected}
                      onCheckedChange={(checked) => updateRow(index, 'selected', checked === true)}
                    />
                  </td>
                  <td className="py-2 pr-2 min-w-[180px]">
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(index, 'name', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-2 min-w-[150px]">
                    <Input
                      value={row.neutral_citation}
                      onChange={(e) => updateRow(index, 'neutral_citation', e.target.value)}
                      className="h-8 text-sm font-mono"
                    />
                  </td>
                  <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">{row.paragraph_ref || '-'}</td>
                  <td className="py-2 text-slate-500 text-xs max-w-xs">{row.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}