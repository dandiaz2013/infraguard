import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardCopy, Check } from 'lucide-react';
import { buildCheckPack } from '@/lib/authorityCheck';

export default function CheckPackButton({ record, extracts, label = 'Copy check pack' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(buildCheckPack(record, extracts));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button size="sm" variant="outline" onClick={copy}>
      {copied ? <Check className="h-4 w-4 mr-2" /> : <ClipboardCopy className="h-4 w-4 mr-2" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}