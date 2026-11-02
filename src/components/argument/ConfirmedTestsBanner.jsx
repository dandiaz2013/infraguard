import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale } from 'lucide-react';

export default function ConfirmedTestsBanner({ tests = [] }) {
  const confirmed = tests.filter((test) => test.status === 'Confirmed by user');
  if (confirmed.length === 0) {
    return (
      <Card className="shadow-sm border-amber-300 bg-amber-50">
        <CardContent className="p-4">
          <p className="text-sm text-amber-900 flex items-center gap-2">
            <Scale className="h-4 w-4" />
            No legal test confirmed yet. Confirm the test below before generating: the draft and the checklist both use it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {confirmed.map((test) => {
        const elements = test.elements || [];
        return (
          <Card key={test.id} className="shadow-sm border-l-4 border-l-slate-900">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-900 text-white">Confirmed test</Badge>
                <h3 className="text-sm font-semibold text-slate-900">{test.name}</h3>
                <span className="text-xs text-slate-500">
                  {elements.length} element{elements.length === 1 ? '' : 's'}
                </span>
              </div>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                {elements.map((element, index) => (
                  <li key={index} className="text-xs text-slate-700">
                    {element.text}
                    {(element.source_document_name || element.source_paragraph_ref) && (
                      <span className="text-slate-500">
                        {' '}
                        [{(element.source_document_name || '').trim()}
                        {element.source_paragraph_ref ? `, ${element.source_paragraph_ref}` : ''}]
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}