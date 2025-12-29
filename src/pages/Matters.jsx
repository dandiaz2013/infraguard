import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Briefcase, Filter, X } from 'lucide-react';
import { format } from 'date-fns';

export default function Matters() {
  const [showNewMatter, setShowNewMatter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  
  const [newMatter, setNewMatter] = useState({
    matter_reference: '',
    matter_name: '',
    client_name: '',
    matter_type: 'Civil Litigation',
    court: '',
    status: 'Active',
    description: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
      setShowNewMatter(true);
    }
  }, []);

  const { data: matters = [], isLoading } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.list('-updated_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Matter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['matters']);
      setShowNewMatter(false);
      setNewMatter({
        matter_reference: '',
        matter_name: '',
        client_name: '',
        matter_type: 'Civil Litigation',
        court: '',
        status: 'Active',
        description: ''
      });
    }
  });

  const handleCreate = () => {
    createMutation.mutate(newMatter);
  };

  const filteredMatters = matters.filter(matter => {
    const matchesSearch = 
      matter.matter_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matter.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matter.matter_reference?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || matter.status === filterStatus;
    const matchesType = filterType === 'all' || matter.matter_type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Matters</h1>
            <p className="text-slate-600 mt-1">Manage your legal matters and cases</p>
          </div>
          <Button 
            onClick={() => setShowNewMatter(true)}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Matter
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search matters, clients, references..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Appeal Pending">Appeal Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Matter Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Civil Litigation">Civil Litigation</SelectItem>
                  <SelectItem value="Criminal Defence">Criminal Defence</SelectItem>
                  <SelectItem value="Family Law">Family Law</SelectItem>
                  <SelectItem value="Employment">Employment</SelectItem>
                  <SelectItem value="Contract Dispute">Contract Dispute</SelectItem>
                  <SelectItem value="Judicial Review">Judicial Review</SelectItem>
                  <SelectItem value="Appeal">Appeal</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Matters Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : filteredMatters.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No matters found</h3>
              <p className="text-slate-600 mb-4">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first matter'}
              </p>
              <Button onClick={() => setShowNewMatter(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Matter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatters.map((matter) => (
              <Link key={matter.id} to={createPageUrl('MatterDetail') + '?id=' + matter.id}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full border-l-4 border-l-amber-500">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg font-semibold text-slate-900 line-clamp-2">
                        {matter.matter_name}
                      </CardTitle>
                    </div>
                    {matter.matter_reference && (
                      <p className="text-xs text-slate-500 font-mono">{matter.matter_reference}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Client</p>
                        <p className="text-sm text-slate-600">{matter.client_name}</p>
                      </div>
                      
                      {matter.court && (
                        <div>
                          <p className="text-sm font-medium text-slate-700">Court</p>
                          <p className="text-sm text-slate-600">{matter.court}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          {matter.matter_type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          matter.status === 'Active' ? 'bg-green-100 text-green-700' :
                          matter.status === 'On Hold' ? 'bg-yellow-100 text-yellow-700' :
                          matter.status === 'Appeal Pending' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {matter.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 pt-2 border-t">
                        Updated {format(new Date(matter.updated_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* New Matter Dialog */}
        <Dialog open={showNewMatter} onOpenChange={setShowNewMatter}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Matter</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="matter_reference">Matter Reference</Label>
                  <Input
                    id="matter_reference"
                    placeholder="e.g., MAT-2024-001"
                    value={newMatter.matter_reference}
                    onChange={(e) => setNewMatter({...newMatter, matter_reference: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={newMatter.status} onValueChange={(v) => setNewMatter({...newMatter, status: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                      <SelectItem value="Appeal Pending">Appeal Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="matter_name">Matter Name *</Label>
                <Input
                  id="matter_name"
                  placeholder="e.g., Smith v Jones - Contract Dispute"
                  value={newMatter.matter_name}
                  onChange={(e) => setNewMatter({...newMatter, matter_name: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  placeholder="e.g., John Smith"
                  value={newMatter.client_name}
                  onChange={(e) => setNewMatter({...newMatter, client_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="matter_type">Matter Type *</Label>
                  <Select value={newMatter.matter_type} onValueChange={(v) => setNewMatter({...newMatter, matter_type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Civil Litigation">Civil Litigation</SelectItem>
                      <SelectItem value="Criminal Defence">Criminal Defence</SelectItem>
                      <SelectItem value="Family Law">Family Law</SelectItem>
                      <SelectItem value="Employment">Employment</SelectItem>
                      <SelectItem value="Contract Dispute">Contract Dispute</SelectItem>
                      <SelectItem value="Judicial Review">Judicial Review</SelectItem>
                      <SelectItem value="Appeal">Appeal</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="court">Court/Tribunal</Label>
                  <Input
                    id="court"
                    placeholder="e.g., High Court of Justice"
                    value={newMatter.court}
                    onChange={(e) => setNewMatter({...newMatter, court: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the matter..."
                  value={newMatter.description}
                  onChange={(e) => setNewMatter({...newMatter, description: e.target.value})}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewMatter(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!newMatter.matter_name || !newMatter.client_name || !newMatter.matter_type}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Create Matter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}