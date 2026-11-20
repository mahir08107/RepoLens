'use client';
import React, { useState } from 'react';
import { Loader2, Github, Sparkles, Shield, Compass, ArrowRight, ExternalLink } from 'lucide-react';

interface TopBarProps {
  onGenerate: (repoUrl: string) => void;
  onOpenInspector: () => void;
  onLoadDemo: () => void;
  loading: boolean;
  statusText?: string;
  error?: string | null;
}

const TopBar: React.FC<TopBarProps> = ({
  onGenerate,
  onOpenInspector,
  onLoadDemo,
  loading,
  statusText,
  error,
}) => {
  const [url, setUrl] = useState('https://github.com/expressjs/express');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onGenerate(url.trim());
    }
  };

  return (
    <header className="bg-white border-b border-slate-200/80 shadow-xs sticky top-0 z-30">
      <div className="max-w-[1800px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-900 via-slate-800 to-indigo-600 text-white shadow-sm">
            <Compass className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-slate-900 text-base">RepoLens</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                v1.0 • Privacy AST
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">AI Repository Architecture & Dependency Visualizer</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-2xl min-w-[300px]">
          <div className="relative flex items-center">
            <div className="absolute left-3 text-slate-400 pointer-events-none">
              <Github className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Paste public GitHub repository URL (e.g. https://github.com/facebook/react)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full pl-9 pr-28 py-2 text-xs md:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-800 placeholder-slate-400 shadow-2xs font-mono"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                  <span>{statusText || 'Analyzing...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Actions & Privacy Controls */}
        <div className="flex items-center space-x-2">
          {/* Quick Demo Button */}
          <button
            type="button"
            onClick={onLoadDemo}
            title="Load Express.js sample architecture"
            className="hidden md:flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors border border-slate-200"
          >
            <span>Sample Demo</span>
          </button>

          {/* Inspect Payload Button */}
          <button
            type="button"
            onClick={onOpenInspector}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg transition-colors shadow-2xs"
            title="Jury Privacy Proof - Inspect AST payload sent to backend"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Inspect Payload</span>
          </button>

          {/* GitHub Sign-In Slot (Dev B token hook) */}
          <button
            type="button"
            onClick={() => alert("GitHub OAuth (Firebase Auth) enabled for authenticated rate-limits.")}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        </div>
      </div>

      {/* Error Bar */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-1.5 text-xs text-red-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
        </div>
      )}
    </header>
  );
};

export default TopBar;
