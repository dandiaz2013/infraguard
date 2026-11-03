import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

// The fact pattern and its expansions. Each line is checked against the record in
// the fields panel, so what is written here is never treated as record evidence.
export default function FactExpansionsCard({
  factPattern,
  onFactPatternChange,
  fields = [],
  onGenerate,
  isGenerating,
  onCorrectFacts,
  isCorrectingFacts,
  canCorrect,
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Facts and expansions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="facts" className="text-xs">Core fact pattern *</Label>
          <Textarea
            id="facts"
            value={factPattern}
            onChange={(event) => onFactPatternChange(event.target.value)}
            rows={4}
            className="text-sm bg-slate-50"
            placeholder="Auto-populated from the matter. Edit as needed."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([id, label, value, setter]) => (
            <div key={id}>
              <Label htmlFor={id} className="text-xs">{label}</Label>
              <Textarea
                id={id}
                value={value}
                onChange={(event) => setter(event.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Build the argument around the seven issues
          </Button>
          <Button size="sm" variant="outline" onClick={onCorrectFacts} disabled={isCorrectingFacts || !canCorrect}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Correct facts
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}