import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Quote, ShieldAlert } from 'lucide-react';
import { BAND_STYLES } from '@/lib/scoring';

const BAND_ORDER = ['Poor', 'Speculative', 'Arguable', 'Strong'];

export default function CaseLawDashboardCards() {
  const { data: matters = [] } = useQuery({
    queryKey: ['mattersForBands'],
    queryFn: () => base44.entities.Matter.list(),
  });

  const { data: caseLaw = [] } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const { data: citations = [] } = useQuery({
    queryKey: ['judgmentCitationsAll'],
    queryFn: () => base44.entities.JudgmentCitation.list(),
  });

  const { data: usages = [] } = useQuery({
    queryKey: ['caseLawUsagesAll'],
    queryFn: () => base44.entities.CaseLawUsage.list(),
  });

  const bandCounts = BAND_ORDER.reduce((acc, band) => {
    acc[band] = matters.filter((matter) => matter.merits_band === band).length;
    return acc;
  }, {});
  const unscored = matters.filter((matter) => !matter.merits_band).length;

  const citationCounts = [...citations, ...usages].reduce((acc, item) => {
    acc[item.case_law_id] = (acc[item.case_law_id] || 0) + 1;
    return acc;
  }, {});

  const mostCited = caseLaw
    .map((record) => ({ ...record, uses: citationCounts[record.id] || 0 }))
    .filter((record) => record.uses > 0)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 5);

  const unverified = caseLaw.filter((record) => record.verified !== true);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-slate-500" />
            Matters by band
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-2">
          {BAND_ORDER.map((band) => (
            <div key={band} className="flex items-center justify-between">
              <Badge className={BAND_STYLES[band]}>{band}</Badge>
              <span className="font-mono text-slate-900">{bandCounts[band]}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 text-sm text-slate-500">
            <span>Not scored</span>
            <span className="font-mono">{unscored}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Quote className="h-4 w-4 text-slate-500" />
            Most cited authorities
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {mostCited.length === 0 ? (
            <p className="text-sm text-slate-500">No authorities cited yet.</p>
          ) : (
            <div className="space-y-2">
              {mostCited.map((record) => (
                <Link
                  key={record.id}
                  to={createPageUrl('CaseLawDetail') + '?id=' + record.id}
                  className="flex items-center justify-between gap-2 text-sm hover:underline"
                >
                  <span className="text-slate-800 truncate">{record.name}</span>
                  <span className="font-mono text-slate-500">{record.uses}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Awaiting verification
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 ml-auto">
              {unverified.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {unverified.length === 0 ? (
            <p className="text-sm text-slate-500">Every authority in the library is verified.</p>
          ) : (
            <div className="space-y-2">
              {unverified.slice(0, 5).map((record) => (
                <Link
                  key={record.id}
                  to={createPageUrl('CaseLawDetail') + '?id=' + record.id}
                  className="block text-sm text-slate-800 hover:underline truncate"
                >
                  {record.name}
                </Link>
              ))}
              <Link to={createPageUrl('CaseLawLibrary')}>
                <Button variant="link" size="sm" className="px-0">
                  Review the library
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}