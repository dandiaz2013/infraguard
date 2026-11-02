import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Scale, Gavel } from 'lucide-react';
import CaseLawFormDialog from '@/components/caselaw/CaseLawFormDialog';
import MainAuthorityDialog from '@/components/caselaw/MainAuthorityDialog';
import CaseLawCard from '@/components/caselaw/CaseLawCard';

export default function CaseLawLibrary() {
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mainDialogOpen, setMainDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: caseLaw = [], isLoading } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
  });

  const { data: extracts = [] } = useQuery({
    queryKey: ['authorityExtracts'],
    queryFn: () => base44.entities.AuthorityExtract.list('-added_date'),
  });

  const { data: matters = [] } = useQuery({
    queryKey: ['matters', 'all'],
    queryFn: () => base44.entities.Matter.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.CaseLaw.update(editing.id, data)
        : base44.entities.CaseLaw.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseLaw'] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = caseLaw.filter((record) => {
    const matchesTerm =
      !term ||
      [record.name, record.neutral_citation, record.court, record.summary]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term));
    const matchesVerified =
      verifiedFilter === 'all' ||
      (verifiedFilter === 'verified' && record.verified === true) ||
      (verifiedFilter === 'unverified' && record.verified !== true);
    return matchesTerm && matchesVerified;
  });

  const extractsFor = (id) => extracts.filter((extract) => extract.case_law_id === id);
  const mainAuthorities = filtered.filter((record) => record.is_main === true);
  const otherAuthorities = filtered.filter((record) => record.is_main !== true);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openAddMain = () => {
    setEditing(null);
    setMainDialogOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    if (record.is_main === true) setMainDialogOpen(true);
    else setDialogOpen(true);
  };

  const refreshMain = () => {
    queryClient.invalidateQueries({ queryKey: ['caseLaw'] });
    queryClient.invalidateQueries({ queryKey: ['authorityExtracts'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Case Law Library</h1>
            <p className="text-slate-600">
              One master record per authority. Unverified records are shown in amber.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openAddMain} className="bg-slate-900 hover:bg-slate-800">
              <Gavel className="h-4 w-4 mr-2" />
              Add main authority
            </Button>
            <Button onClick={openAdd} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add authority
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, citation, court or summary..."
              className="pl-9"
            />
          </div>
          <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All authorities</SelectItem>
              <SelectItem value="verified">Verified only</SelectItem>
              <SelectItem value="unverified">Unverified only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Scale className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No authorities found</h3>
              <p className="text-slate-600 mb-4">
                Add a main authority with its paragraph extracts, or parse one out of a judgment.
              </p>
              <Button onClick={openAddMain} variant="outline">
                <Gavel className="h-4 w-4 mr-2" />
                Add main authority
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xl font-semibold text-slate-900">
                  Main Authorities ({mainAuthorities.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Listed first in every argument. Quoted only from stored extracts.
                </p>
              </div>
              {mainAuthorities.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-slate-600">
                    No main authority yet. Add one with paragraph extracts to quote it safely in arguments.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {mainAuthorities.map((record) => (
                    <CaseLawCard
                      key={record.id}
                      record={record}
                      extracts={extractsFor(record.id)}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              )}
            </section>

            {otherAuthorities.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">
                  Other authorities ({otherAuthorities.length})
                </h2>
                <div className="space-y-3">
                  {otherAuthorities.map((record) => (
                    <CaseLawCard
                      key={record.id}
                      record={record}
                      extracts={[]}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <CaseLawFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          initial={editing}
          onSave={(data) => saveMutation.mutate(data)}
          isSaving={saveMutation.isPending}
        />

        <MainAuthorityDialog
          open={mainDialogOpen}
          onOpenChange={(open) => {
            setMainDialogOpen(open);
            if (!open) setEditing(null);
          }}
          initial={editing && editing.is_main === true ? editing : null}
          matters={matters}
          onSaved={refreshMain}
        />
      </div>
    </div>
  );
}