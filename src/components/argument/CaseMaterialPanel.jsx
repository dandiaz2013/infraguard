import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FolderOpen } from 'lucide-react';
import MaterialItemList from '@/components/argument/MaterialItemList';

const PROCEDURAL_ITEMS = [
  ['court_confirmed', 'Court confirmed'],
  ['route_confirmed', 'Route (claim, appeal, application) confirmed'],
  ['time_limit_confirmed', 'Time limit confirmed against the documents'],
];

export default function CaseMaterialPanel({
  ourPoints, onAddPoint, onRemovePoint,
  clauses, onAddClause, onRemoveClause, onToggleClause,
  misstatements, onAddMisstatement, onRemoveMisstatement,
  procedural, onProceduralChange,
}) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-5 w-5 text-slate-700" />
          Case material behind this version
        </CardTitle>
        <CardDescription>
          Everything here is checked against the documents. Save the version to keep it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <MaterialItemList
            title="Our points"
            hint="Each point with the document and paragraph that proves it. A point with no reference counts as a user statement."
            fields={[
              { key: 'text', placeholder: 'The point we make' },
              { key: 'document_name', placeholder: 'Document name' },
              { key: 'paragraph_ref', placeholder: 'Paragraph' },
            ]}
            items={ourPoints}
            onAdd={onAddPoint}
            onRemove={onRemovePoint}
            inputId="point-input"
          />

          <MaterialItemList
            title="Contract clauses / rules"
            hint="The clause or rule relied on, and whether you have checked the wording yourself."
            fields={[
              { key: 'reference', placeholder: 'Clause 7.2' },
              { key: 'text', placeholder: 'Exact clause text' },
              { key: 'document_name', placeholder: 'Document name' },
            ]}
            items={clauses}
            onAdd={(item) => onAddClause({ ...item, checked: false })}
            onRemove={onRemoveClause}
            onToggle={onToggleClause}
            toggleLabel="Checked word for word"
            inputId="clause-reference"
          />

          <MaterialItemList
            title="Misstatements by the other side"
            hint="What they say, what is actually correct, and the document that proves it."
            fields={[
              { key: 'statement', placeholder: 'What they say' },
              { key: 'correct_position', placeholder: 'What is correct' },
              { key: 'document_name', placeholder: 'Document name' },
              { key: 'paragraph_ref', placeholder: 'Paragraph' },
            ]}
            items={misstatements}
            onAdd={onAddMisstatement}
            onRemove={onRemoveMisstatement}
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900">Procedural position</h4>
          <p className="text-xs text-slate-500 mb-2">Tick each point once you have checked it against the documents.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROCEDURAL_ITEMS.map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-xs text-slate-700">
                <Checkbox
                  checked={Boolean(procedural?.[key])}
                  onCheckedChange={(value) => onProceduralChange({ ...procedural, [key]: value === true })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}