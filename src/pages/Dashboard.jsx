import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, FileText, Scale, Search, Plus, 
  TrendingUp, Clock, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.list('-updated_date', 5)
  });

  const { data: allMatters = [] } = useQuery({
    queryKey: ['allMatters'],
    queryFn: () => base44.entities.Matter.list()
  });

  const { data: authorities = [] } = useQuery({
    queryKey: ['authorities'],
    queryFn: () => base44.entities.LegalAuthority.list('-created_date', 10)
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-updated_date', 5)
  });

  const activeMatters = allMatters.filter(m => m.status === 'Active').length;
  const totalAuthorities = authorities.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Legal Research Platform</h1>
          <p className="text-slate-600">AI-powered legal research and document generation for UK law</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active Matters</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{activeMatters}</p>
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Legal Authorities</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{totalAuthorities}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Scale className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Documents</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{documents.length}</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Research Sessions</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">-</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Search className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to={createPageUrl('Matters') + '?action=new'}>
            <Button className="w-full h-24 bg-slate-900 hover:bg-slate-800 text-white flex flex-col gap-2">
              <Plus className="h-6 w-6" />
              <span>New Matter</span>
            </Button>
          </Link>
          
          <Link to={createPageUrl('Research')}>
            <Button className="w-full h-24 bg-amber-600 hover:bg-amber-700 text-white flex flex-col gap-2">
              <Search className="h-6 w-6" />
              <span>Legal Research</span>
            </Button>
          </Link>
          
          <Link to={createPageUrl('ArgumentBuilder')}>
            <Button className="w-full h-24 bg-blue-600 hover:bg-blue-700 text-white flex flex-col gap-2">
              <Scale className="h-6 w-6" />
              <span>Build Arguments</span>
            </Button>
          </Link>
          
          <Link to={createPageUrl('DocumentGenerator')}>
            <Button className="w-full h-24 bg-green-600 hover:bg-green-700 text-white flex flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>Generate Documents</span>
            </Button>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Matters */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-900">Recent Matters</CardTitle>
                <Link to={createPageUrl('Matters')}>
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {matters.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No matters yet</p>
                  <Link to={createPageUrl('Matters') + '?action=new'}>
                    <Button variant="link" className="mt-2">Create your first matter</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {matters.map((matter) => (
                    <Link 
                      key={matter.id} 
                      to={createPageUrl('MatterDetail') + '?id=' + matter.id}
                      className="block p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{matter.matter_name}</h3>
                          <p className="text-sm text-slate-600 mt-1">{matter.client_name}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                              {matter.matter_type}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              matter.status === 'Active' ? 'bg-green-100 text-green-700' :
                              matter.status === 'On Hold' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {matter.status}
                            </span>
                          </div>
                        </div>
                        <Clock className="h-4 w-4 text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Documents */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-900">Recent Documents</CardTitle>
                <Link to={createPageUrl('DocumentGenerator')}>
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No documents yet</p>
                  <Link to={createPageUrl('DocumentGenerator')}>
                    <Button variant="link" className="mt-2">Generate your first document</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{doc.title}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              {doc.document_type}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              doc.status === 'Final' ? 'bg-green-100 text-green-700' :
                              doc.status === 'Review' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {doc.status}
                            </span>
                          </div>
                        </div>
                        {doc.status === 'Final' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}