import React from 'react';
import { Check } from 'lucide-react';

export default function WorkflowProgress({ steps, done, activeIndex, onSelect }) {
  const completed = done.filter(Boolean).length;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const isDone = done[index];
          const isActive = index === activeIndex;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onSelect(index)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                isActive
                  ? 'border-slate-900 bg-slate-900'
                  : isDone
                    ? 'border-green-200 bg-green-50 hover:bg-green-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActive
                      ? 'bg-amber-500 text-slate-900'
                      : isDone
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isDone && !isActive ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                  {step.label}
                </span>
              </div>
              <p className={`mt-1 text-xs leading-snug ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                {step.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}