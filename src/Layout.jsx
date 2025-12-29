import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  Scale, 
  Home, 
  Briefcase, 
  Search, 
  FileText, 
  TrendingUp,
  Menu,
  X,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', icon: Home, href: createPageUrl('Dashboard') },
    { name: 'Matters', icon: Briefcase, href: createPageUrl('Matters') },
    { name: 'Research', icon: Search, href: createPageUrl('Research') },
    { name: 'ArgumentBuilder', icon: Scale, href: createPageUrl('ArgumentBuilder'), label: 'Arguments' },
    { name: 'DocumentGenerator', icon: FileText, href: createPageUrl('DocumentGenerator'), label: 'Documents' },
    { name: 'JudgmentAnalyzer', icon: BookOpen, href: createPageUrl('JudgmentAnalyzer'), label: 'Analyzer' },
    { name: 'Analytics', icon: TrendingUp, href: createPageUrl('Analytics') },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-white transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <Scale className="h-8 w-8 text-amber-500" />
              <div>
                <h1 className="text-lg font-bold">Legal Research</h1>
                <p className="text-xs text-slate-400">UK Law Platform</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = currentPageName === item.name;
              const Icon = item.icon;
              const displayName = item.label || item.name;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-amber-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium">{displayName}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center">
              UK Legal Research Platform
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}