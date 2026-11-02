import React from 'react';
import { Badge } from '@/components/ui/badge';

const RESULT_STYLE = {
  Yes: 'bg-green-100 text-green-800 border-green-200',
  Partly: 'bg-amber-100 text-amber-800 border-amber-200',
  No: 'bg-red-100 text-red-800 border-red-200',
};

const PRIORITY_STYLE = {
  High: 'bg-slate-900 text-white border-slate-900',
  Medium: 'bg-slate-100 text-slate-700 border-slate-200',
  Low: 'bg-white text-slate-500 border-slate-200',
};

export default function ChecklistTable({ checklist }) {
  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
      {checklist.map((item) => (
        <div key={item.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-900">{item.label}</p>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Badge variant="outline" className={PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.Medium}>
                {item.priority}
              </Badge>
              <Badge variant="outline" className={RESULT_STYLE[item.result] || RESULT_STYLE.No}>
                {item.result}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-1">{item.reason}</p>
          {item.details?.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {item.details.map((line, index) => (
                <li key={index} className="text-[11px] text-slate-500">
                  • {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}