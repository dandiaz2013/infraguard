import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListChecks } from 'lucide-react';
import FieldStateCard from '@/components/argument/FieldStateCard';
import { groupCounts } from '@/lib/fieldStates';

// Every field the argument rests on, each in one of three states.
export default function FieldStatesPanel({ groups = [], onSave, onRemove, onOpenRecord }) {
  const counts = groupCounts(groups);

  return (
    <Card className="shadow-md" id="field-states">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-5 w-5 text-slate-700" />
          Fields behind this argument
        </CardTitle>
        <CardDescription>
          {counts.documents} from the documents, {counts.yours} written by you, {counts.missing} not yet provided.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">{group.label}</h4>
              <Badge variant="outline" className="text-[10px]">
                {group.fields.length}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">{group.hint}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {group.fields.map((field) => (
                <FieldStateCard
                  key={field.key}
                  field={field}
                  onSave={onSave}
                  onRemove={onRemove}
                  onOpenRecord={onOpenRecord}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}