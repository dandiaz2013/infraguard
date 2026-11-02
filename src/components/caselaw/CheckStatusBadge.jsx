import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { isChecked } from '@/lib/authorityCheck';

export default function CheckStatusBadge({ record }) {
  if (isChecked(record)) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
        <ShieldCheck className="h-3 w-3 mr-1" />
        Extract checked against official text
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Not checked
    </Badge>
  );
}