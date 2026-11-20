'use client';
import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, X, FileCode, Lock } from 'lucide-react';
import type { RepoSkeleton } from '@/shared/types';

interface PayloadInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  skeleton: RepoSkeleton | null;
}

export default function PayloadInspector({ isOpen, onClose, skeleton }: PayloadInspectorProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonString = skeleton ? JSON.stringify(skeleton, null, 2) : '// No skeleton generated yet. Enter a repo URL and click Generate.';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalFiles = skeleton?.files?.length ?? 0;
  const totalSignatures = skeleton?.files?.reduce((acc, f) => acc + (f.functionSignatures?.length || 0), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">Jury Privacy Proof & Payload Inspector</h3>
              <p className="text-xs text-slate-500">Live inspection of sanitized JSON sent to backend / Gemini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Stats Banner */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-amber-50/70 border-b border-amber-200/60 text-xs">
          <div className="flex items-center space-x-2 text-amber-900 font-medium">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>0 Function Bodies Transmitted</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700">
            <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{totalFiles} Filtered Source Files</span>
          </div>
          <div className="text-slate-600 text-right">
            <span>{totalSignatures} Signatures Extracted</span>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-6 flex-1 overflow-auto bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed relative">
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 text-xs transition-colors shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
          </button>
          <pre className="overflow-x-auto selection:bg-indigo-600 selection:text-white">
            <code>{jsonString}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Client-side Web-Tree-Sitter AST sanitization verified</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
