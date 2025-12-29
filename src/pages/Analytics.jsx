import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Scale, FileText, BookOpen, Award } from 'lucide-react';

const COLORS = ['#0f172a', '#1e40af', '#7c3aed', '#db2777', '#ea580c', '#65a30d'];

export default function Analytics() {
  const { data: authorities = [] } = useQuery({
    queryKey: ['authorities'],
    queryFn: () => base44.entities.LegalAuthority.list()
  });

  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: () => base44.entities.Matter.list()
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list()
  });

  // Citation Trends Analysis
  const citationTrends = useMemo(() => {
    const yearCounts = {};
    authorities.forEach(auth => {
      if (auth.year) {
        yearCounts[auth.year] = (yearCounts[auth.year] || 0) + 1;
      }
    });
    return Object.entries(yearCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([year, count]) => ({ year, count }));
  }, [authorities]);

  // Authority Types Distribution
  const authorityTypes = useMemo(() => {
    const types = {};
    authorities.forEach(auth => {
      types[auth.authority_type] = (types[auth.authority_type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [authorities]);

  // Most Cited Authorities
  const topAuthorities = useMemo(() => {
    const citationCounts = {};
    authorities.forEach(auth => {
      const key = auth.title;
      citationCounts[key] = (citationCounts[key] || 0) + 1;
    });
    return Object.entries(citationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([title, count]) => ({ title: title.substring(0, 40) + '...', count }));
  }, [authorities]);

  // Court Distribution
  const courtDistribution = useMemo(() => {
    const courts = {};
    authorities.forEach(auth => {
      if (auth.court) {
        courts[auth.court] = (courts[auth.court] || 0) + 1;
      }
    });
    return Object.entries(courts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([court, count]) => ({ court: court.substring(0, 30), count }));
  }, [authorities]);

  // Matter Type Distribution
  const matterTypes = useMemo(() => {
    const types = {};
    matters.forEach(matter => {
      types[matter.matter_type] = (types[matter.matter_type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [matters]);

  // Document Status Overview
  const documentStatus = useMemo(() => {
    const statuses = {};
    documents.forEach(doc => {
      statuses[doc.status] = (statuses[doc.status] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [documents]);

  // Key Legal Principles
  const legalPrinciples = useMemo(() => {
    const principles = {};
    authorities.forEach(auth => {
      if (auth.legal_principle) {
        const words = auth.legal_principle.toLowerCase().split(' ');
        const keywords = ['duty', 'breach', 'negligence', 'contract', 'damages', 'liability', 
                         'fair', 'reasonable', 'standard', 'test', 'burden', 'proof', 'evidence'];
        words.forEach(word => {
          if (keywords.includes(word) && word.length > 3) {
            principles[word] = (principles[word] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(principles)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([principle, count]) => ({ principle, count }));
  }, [authorities]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Legal Analytics Dashboard</h1>
          <p className="text-slate-600">Citation trends, authority patterns, and case law insights</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Authorities</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{authorities.length}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active Matters</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {matters.filter(m => m.status === 'Active').length}
                  </p>
                </div>
                <Scale className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Documents Generated</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{documents.length}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Avg. Authorities/Matter</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {matters.length > 0 ? (authorities.length / matters.length).toFixed(1) : '0'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Citation Trends */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Citation Trends by Year</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={citationTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#1e40af" strokeWidth={2} name="Citations" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Authority Types */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Authority Types Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={authorityTypes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {authorityTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Cited Authorities */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Most Frequently Cited Authorities</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topAuthorities} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="title" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Court Distribution */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Authorities by Court</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courtDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="court" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Common Legal Principles */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-600" />
                Common Legal Principles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {legalPrinciples.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 capitalize">{item.principle}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-600 rounded-full"
                          style={{ width: `${(item.count / Math.max(...legalPrinciples.map(p => p.count))) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-600 w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Matter Types */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Matter Types Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {matterTypes.map((type, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">{type.name}</span>
                    <Badge variant="outline" className="bg-white">{type.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}