import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import VerifiedBadge from '@/components/caselaw/VerifiedBadge';
import CheckStatusBadge from '@/components/caselaw/CheckStatusBadge';
import CheckPackButton from '@/components/caselaw/CheckPackButton';
import ExtractList from '@/components/caselaw/ExtractList';

export default function CaseLawCard({ record, extracts = [], onEdit }) {
  const isMain = record.is_main === true;

  return (
    <Card
      className={`shadow-sm ${
        isMain
          ? 'border-l-4 border-l-slate-900'
          : record.verified
            ? 'border-l-4 border-l-green-500'
            : 'border-l-4 border-l-amber-500 bg-amber-50/40'
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to={createPageUrl('CaseLawDetail') + '?id=' + record.id}
              className="text-lg font-semibold text-slate-900 hover:underline"
            >
              {record.name}
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {isMain && <CheckStatusBadge record={record} />}
              <VerifiedBadge verified={record.verified} />
              {record.neutral_citation && (
                <span className="text-sm font-mono text-slate-600">{record.neutral_citation}</span>
              )}
              {record.court && <span className="text-sm text-slate-500">{record.court}</span>}
              {record.year && <span className="text-sm text-slate-500">{record.year}</span>}
            </div>
            {record.summary && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{record.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isMain && <CheckPackButton record={record} extracts={extracts} />}
            <Button size="icon" variant="ghost" onClick={() => onEdit(record)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isMain && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
              Paragraph extracts ({extracts.length})
            </p>
            <ExtractList extracts={extracts} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}