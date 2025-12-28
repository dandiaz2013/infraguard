import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Scale } from 'lucide-react';

export default function ArgumentBuilder() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Argument Builder</h1>
          <p className="text-slate-600">Structure your legal arguments with supporting authorities</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <Scale className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Coming Soon</h3>
            <p className="text-slate-600">Build structured legal arguments with drag-and-drop interface</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}