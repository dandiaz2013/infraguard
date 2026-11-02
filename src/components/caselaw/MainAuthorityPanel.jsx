import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gavel, ExternalLink } from 'lucide-react';
import CheckStatusBadge from '@/components/caselaw/CheckStatusBadge';
import CheckPackButton from '@/components/caselaw/CheckPackButton';
import ExtractList from '@/components/caselaw/ExtractList';

export default function MainAuthorityPanel({ matterId }) {
  const { data: caseLaw = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const { data: extracts = [] } = useQuery({
    queryKey: ['authorityExtracts'],
    queryFn: () => base44.entities.AuthorityExtract.list('-added_date'),
  });

  const mainAuthorities = caseLaw.filter((record) => record.is_main === true);

  const extractsFor = (id) => extracts.filter((extract) => extract.case_law_id === id);

  return (
    <Card className="mb-8 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4 w-4 text-slate-500" />
          Main Authorities
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mainAuthorities.length === 0 ? (
          <p className="text-sm text-slate-600">
            No main authority yet.{' '}
            <Link to={createPageUrl('CaseLawLibrary')} className="text-slate-900 underline">
              Add one in the Case Law Library
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-5">
            {mainAuthorities.map((record) => {
              const recordExtracts = extractsFor(record.id);
              const link = record.official_url || record.url;
              return (
                <div key={record.id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        to={createPageUrl('CaseLawDetail') + '?id=' + record.id}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {record.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {record.neutral_citation && (
                          <span className="text-xs font-mono text-slate-600">{record.neutral_citation}</span>
                        )}
                        {record.court && <span className="text-xs text-slate-500">{record.court}</span>}
                        <CheckStatusBadge record={record} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {link && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <CheckPackButton record={record} extracts={recordExtracts} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <ExtractList
                      extracts={recordExtracts.filter(
                        (extract) =>
                          (extract.matter_ids || []).length === 0 || (extract.matter_ids || []).includes(matterId)
                      )}
                      emptyText="No paragraph extract stored. Cite by name and citation only: [NO EXTRACT - PARAGRAPH NEEDED]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}