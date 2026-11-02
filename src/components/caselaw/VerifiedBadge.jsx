import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export default function VerifiedBadge({ verified }) {
  if (verified) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
      <ShieldAlert className="h-3 w-3" />
      Unverified
    </Badge>
  );
}