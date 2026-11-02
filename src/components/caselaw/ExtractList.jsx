import React from 'react';
import { Quote } from 'lucide-react';

export default function ExtractList({ extracts = [], emptyText = 'No paragraph extracts stored yet.' }) {
  if (extracts.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {extracts.map((extract) => (
        <li key={extract.id} className="border border-slate-200 rounded-lg p-3 bg-white">
          <div className="flex items-start gap-2">
            <Quote className="h-3.5 w-3.5 text-slate-400 mt-1 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-mono text-slate-600 mb-1">
                {extract.paragraph_ref || 'no paragraph reference'}
              </p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{extract.extract_text}</p>
              {extract.proposition && (
                <p className="text-xs text-slate-600 mt-2">
                  <span className="font-semibold">Proposition:</span> {extract.proposition}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}