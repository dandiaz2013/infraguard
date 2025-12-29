import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Scale, FileText, BookOpen, MessageSquare, 
  Plus, ExternalLink, Calendar, Building2 
} from 'lucide-react';
import { format } from 'date-fns';

export default function MatterDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const matterId = urlParams.get('id');

  const { data: matter, isLoading } = useQuery({
    queryKey: ['matter', matterId],
    queryFn: async () => {
      const matters = await base44.entities.Matter.filter({ id: matterId });
      return matters[0];
    },
    enabled: !!matterId
  });

  const { data: authorities = [] } = useQuery({
    queryKey: ['authorities', matterId],
    queryFn: () => base44.entities.LegalAuthority.filter({ matter_id: matterId }),
    enabled: !!matterId
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', matterId],
    queryFn: () => base44.entities.LegalIssue.filter({ matter_id: matterId }),
    enabled: !!matterId
  });

  const { data: legalArguments = [] } = useQuery({
    queryKey: ['arguments', matterId],
    queryFn: () => base44.entities.Argument.filter({ matter_id: matterId }),
    enabled: !!matterId
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', matterId],
    queryFn: () => base44.entities.Document.filter({ matter_id: matterId }),
    enabled: !!matterId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Matter not found</h2>
          <Link to={createPageUrl('Matters')}>
            <Button variant="outline">Back to Matters</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to={createPageUrl('Matters')}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Matters
            </Button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{matter.matter_name}</h1>
              <div className="flex items-center gap-3">
                {matter.matter_reference && (
                  <span className="text-sm text-slate-600 font-mono">{matter.matter_reference}</span>
                )}
                <Badge className={
                  matter.status === 'Active' ? 'bg-green-100 text-green-700' :
                  matter.status === 'On Hold' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-200 text-slate-700'
                }>
                  {matter.status}
                </Badge>
                <Badge variant="outline">{matter.matter_type}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Matter Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-slate-600 mb-2">Client</h3>
              <p className="text-lg font-semibold text-slate-900">{matter.client_name}</p>
            </CardContent>
          </Card>

          {matter.court && (
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-sm font-medium text-slate-600 mb-2">Court/Tribunal</h3>
                <p className="text-lg font-semibold text-slate-900">{matter.court}</p>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-slate-600 mb-2">Created</h3>
              <p className="text-lg font-semibold text-slate-900">
                {format(new Date(matter.created_date), 'dd MMM yyyy')}
              </p>
            </CardContent>
          </Card>
        </div>

        {matter.description && (
          <Card className="mb-8 shadow-sm">
            <CardHeader>
              <CardTitle>Matter Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{matter.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="authorities" className="space-y-6">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="authorities">
              <BookOpen className="h-4 w-4 mr-2" />
              Authorities ({authorities.length})
            </TabsTrigger>
            <TabsTrigger value="issues">
              <MessageSquare className="h-4 w-4 mr-2" />
              Issues ({issues.length})
            </TabsTrigger>
            <TabsTrigger value="arguments">
              <Scale className="h-4 w-4 mr-2" />
              Arguments ({legalArguments.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents ({documents.length})
            </TabsTrigger>
          </TabsList>

          {/* Authorities Tab */}
          <TabsContent value="authorities" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Legal Authorities</h2>
              <Link to={createPageUrl('Research')}>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Research Authorities
                </Button>
              </Link>
            </div>

            {authorities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No authorities added yet</p>
                  <Link to={createPageUrl('Research')}>
                    <Button variant="link" className="mt-2">Start researching</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {authorities.map((auth) => (
                  <Card key={auth.id} className="shadow-sm border-l-4 border-l-slate-900">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge className="mb-2">{auth.authority_type}</Badge>
                          <h3 className="text-lg font-semibold text-slate-900">{auth.title}</h3>
                          <p className="text-sm text-slate-600 font-mono mt-1">{auth.citation}</p>
                        </div>
                        {auth.url && (
                          <a href={auth.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                      </div>

                      {auth.legal_principle && (
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-slate-700 mb-1">Legal Principle</h4>
                          <p className="text-sm text-slate-600">{auth.legal_principle}</p>
                        </div>
                      )}

                      {auth.relevance && (
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-slate-700 mb-1">Relevance</h4>
                          <p className="text-sm text-slate-600">{auth.relevance}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">Legal issues tracking coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arguments Tab */}
          <TabsContent value="arguments">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Legal Arguments</h2>
              <Link to={createPageUrl('ArgumentBuilder') + '?matter=' + matterId}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Build Argument
                </Button>
              </Link>
            </div>

            {legalArguments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Scale className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No arguments built yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {legalArguments.map((arg) => (
                  <Card key={arg.id} className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{arg.argument_title}</h3>
                          <Badge variant="outline" className="mt-2">{arg.position}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mt-3">{arg.proposition}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Generated Documents</h2>
              <Link to={createPageUrl('DocumentGenerator') + '?matter=' + matterId}>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Document
                </Button>
              </Link>
            </div>

            {documents.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No documents generated yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{doc.title}</h3>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge>{doc.document_type}</Badge>
                            <Badge variant="outline">{doc.status}</Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">View</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}