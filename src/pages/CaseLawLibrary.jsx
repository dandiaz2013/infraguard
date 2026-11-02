import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Scale, Pencil } from 'lucide-react';
import CaseLawFormDialog from '@/components/caselaw/CaseLawFormDialog';
import VerifiedBadge from '@/components/caselaw/VerifiedBadge';

export default function CaseLawLibrary() {
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: caseLaw = [], isLoading } = useQuery({
    queryKey: ['caseLaw'],
    queryFn: () => base44.entities.CaseLaw.list('-created_date'),
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

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setDialogOpen(true);
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
          <Button onClick={openAdd} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="h-4 w-4 mr-2" />
            Add authority
          </Button>
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
                Add an authority manually, or parse one out of a judgment.
              </p>
              <Button onClick={openAdd} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add authority
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((record) => (
              <Card
                key={record.id}
                className={`shadow-sm ${record.verified ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500 bg-amber-50/40'}`}
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
                    <Button size="icon" variant="ghost" onClick={() => openEdit(record)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
      </div>
    </div>
  );
}