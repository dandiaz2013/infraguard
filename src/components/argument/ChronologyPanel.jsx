import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock } from 'lucide-react';

export default function ChronologyPanel({ chronology, onUse }) {
  const entries = chronology?.entries || [];
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-slate-700" />
          Chronology from the record
        </h4>
        <Badge variant="outline">{entries.length} dated entries</Badge>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => onUse(chronology.text)}>
          Use as the chronology
        </Button>
      </div>

      {chronology.delay && (
        <p className={`text-[11px] rounded border px-2 py-1 mb-2 ${chronology.delay.flagged ? 'bg-red-50 border-red-300 text-red-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          {chronology.delay.note}
        </p>
      )}

      <div className="max-h-64 overflow-y-auto border border-slate-200 rounded">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-2 py-1 font-medium">Date</th>
              <th className="text-left px-2 py-1 font-medium">What was said</th>
              <th className="text-left px-2 py-1 font-medium">Who</th>
              <th className="text-left px-2 py-1 font-medium">Reference</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={`${entry.date}-${entry.ref}-${index}`} className="border-t border-slate-100">
                <td className="px-2 py-1 whitespace-nowrap text-slate-900">{entry.stated_as || entry.date}</td>
                <td className="px-2 py-1 text-slate-700">{entry.quote.slice(0, 150)}</td>
                <td className="px-2 py-1 whitespace-nowrap text-slate-600">{entry.who_label}</td>
                <td className="px-2 py-1 whitespace-nowrap text-slate-600">{entry.document_name}, {entry.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(chronology.intervals || []).length > 0 && (
        <p className="text-[11px] text-slate-600 mt-2">
          Longest gaps: {chronology.intervals.slice().sort((a, b) => b.days - a.days).slice(0, 3).map((gap) => `${gap.days} days (${gap.from} to ${gap.to})`).join('; ')}
        </p>
      )}
    </div>
  );
}