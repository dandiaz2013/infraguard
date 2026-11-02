import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DraftNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>Draft for review. Check every authority against the official judgment before filing. Not legal advice.</span>
    </div>
  );
}