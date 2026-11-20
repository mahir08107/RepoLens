'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { ShieldCheck, Copy, Check, X, FileCode, Lock, Search, GitBranch, Braces } from 'lucide-react';
import type { RepoSkeleton, FileSkeleton } from '@/shared/types';

interface PayloadInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  skeleton: RepoSkeleton | null;
}

export default function PayloadInspector({ isOpen, onClose, skeleton }: PayloadInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'split' | 'raw'>('split');
  const [fileFilter, setFileFilter] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const files = skeleton?.files || [];

  useEffect(() => {
    if (files.length > 0 && (!selectedFilePath || !files.some((f) => f.filePath === selectedFilePath))) {
      setSelectedFilePath(files[0].filePath);
    }
  }, [files, selectedFilePath]);

  const filteredFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.filePath.toLowerCase().includes(q));
  }, [files, fileFilter]);

  const selectedFile: FileSkeleton | null = useMemo(() => {
    return files.find((f) => f.filePath === selectedFilePath) || filteredFiles[0] || null;
  }, [files, filteredFiles, selectedFilePath]);

  if (!isOpen) return null;

  const jsonString = skeleton
    ? JSON.stringify(skeleton, null, 2)
    : '// No skeleton generated yet. Enter a repo URL and click Analyze.';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalFiles = files.length;
  const totalSignatures = files.reduce((acc, f) => acc + (f.functionSignatures?.length || 0), 0);
  const totalImports = files.reduce((acc, f) => acc + (f.imports?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2328]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#ffffff] rounded-xl shadow-2xl border border-[#d0d7de] w-full max-w-4xl flex flex-col max-h-[88vh] overflow-hidden text-[#1f2328]">
        {/* 1. Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#d0d7de] bg-[#f6f8fa]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#dafbe1] text-[#1a7f37] border border-[#1a7f37]/20 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1f2328] text-sm sm:text-base leading-tight">
                AST Privacy &amp; Payload Inspector
              </h3>
              <p className="text-xs text-[#656d76]">
                Zero-trust verification: raw source code stays in your browser Web Worker
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Segmented Toggle: Split View | Raw JSON */}
            <div className="flex items-center bg-white border border-[#d0d7de] rounded-md p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTab('split')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  tab === 'split'
                    ? 'bg-[#0969da] text-white'
                    : 'text-[#656d76] hover:text-[#1f2328]'
                }`}
              >
                Split View
              </button>
              <button
                type="button"
                onClick={() => setTab('raw')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  tab === 'raw'
                    ? 'bg-[#0969da] text-white'
                    : 'text-[#656d76] hover:text-[#1f2328]'
                }`}
              >
                Raw JSON
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="h-8 px-2.5 flex items-center space-x-1.5 bg-white hover:bg-[#eaeef2] border border-[#d0d7de] rounded-md text-[#24292f] text-xs font-medium transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#1a7f37]" />
                  <span className="text-[#1a7f37]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#656d76]" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="p-1.5 text-[#656d76] hover:text-[#1f2328] hover:bg-[#eaeef2] rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Privacy Audit Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de] text-xs">
          <div className="flex items-center space-x-2 bg-white border border-[#d0d7de] rounded-md px-2.5 py-1.5">
            <Lock className="w-3.5 h-3.5 text-[#1a7f37] shrink-0" />
            <div className="truncate">
              <span className="text-[#656d76]">Raw Bodies Sent: </span>
              <strong className="font-mono text-[#1a7f37]">0 bytes</strong>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white border border-[#d0d7de] rounded-md px-2.5 py-1.5">
            <FileCode className="w-3.5 h-3.5 text-[#0969da] shrink-0" />
            <div className="truncate">
              <span className="text-[#656d76]">Parsed AST Files: </span>
              <strong className="font-mono text-[#1f2328]">{totalFiles}</strong>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white border border-[#d0d7de] rounded-md px-2.5 py-1.5">
            <Braces className="w-3.5 h-3.5 text-[#bf8700] shrink-0" />
            <div className="truncate">
              <span className="text-[#656d76]">Signatures: </span>
              <strong className="font-mono text-[#1f2328]">{totalSignatures}</strong>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white border border-[#d0d7de] rounded-md px-2.5 py-1.5">
            <GitBranch className="w-3.5 h-3.5 text-[#656d76] shrink-0" />
            <div className="truncate">
              <span className="text-[#656d76]">Import Edges: </span>
              <strong className="font-mono text-[#1f2328]">{totalImports}</strong>
            </div>
          </div>
        </div>

        {/* 3. Main Content: Split View vs Raw JSON */}
        {tab === 'split' ? (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Left Pane (w-5/12, #f6f8fa): Searchable File List */}
            <div className="w-full md:w-5/12 bg-[#f6f8fa] border-b md:border-b-0 md:border-r border-[#d0d7de] flex flex-col min-h-[200px] max-h-[320px] md:max-h-none overflow-hidden">
              <div className="p-2.5 border-b border-[#d0d7de]">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#656d76] absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    placeholder="Filter parsed files..."
                    className="w-full h-7 pl-8 pr-2 text-xs bg-white border border-[#d0d7de] rounded-md focus:outline-none focus:border-[#0969da] font-mono text-[#1f2328] placeholder-[#656d76]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#eaeef2]">
                {filteredFiles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#656d76]">
                    No parsed files match &quot;{fileFilter}&quot;
                  </div>
                ) : (
                  filteredFiles.map((f) => {
                    const isSelected = selectedFile?.filePath === f.filePath;
                    return (
                      <button
                        key={f.filePath}
                        type="button"
                        onClick={() => setSelectedFilePath(f.filePath)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#ddf4ff] border-l-2 border-l-[#0969da]'
                            : 'hover:bg-[#eaeef2]/60'
                        }`}
                      >
                        <span
                          className={`font-mono text-[11.5px] truncate ${
                            isSelected ? 'font-semibold text-[#0969da]' : 'text-[#1f2328]'
                          }`}
                          title={f.filePath}
                        >
                          {f.filePath}
                        </span>
                        <div className="flex items-center space-x-1 shrink-0 text-[10px] font-mono text-[#656d76]">
                          <span className="px-1.5 py-0.5 rounded bg-white border border-[#d0d7de]">
                            {f.functionSignatures?.length || 0}ƒ
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white border border-[#d0d7de]">
                            {f.imports?.length || 0} imp
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane (w-7/12, #ffffff): Visual AST Breakdown + Dark JSON */}
            <div className="w-full md:w-7/12 bg-[#ffffff] flex-1 overflow-y-auto p-4 space-y-4">
              {selectedFile ? (
                <>
                  <div className="pb-2 border-b border-[#eaeef2]">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-[#656d76] mb-0.5">
                      Selected Module AST
                    </div>
                    <div className="font-mono text-xs font-semibold text-[#1f2328] break-all">
                      {selectedFile.filePath}
                    </div>
                  </div>

                  {/* Extracted Exports (Green Pills) */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76] mb-1.5">
                      Extracted Exports ({selectedFile.exports?.length || 0})
                    </h4>
                    {selectedFile.exports && selectedFile.exports.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedFile.exports.map((exp, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#dafbe1] text-[#1a7f37] border border-[#1a7f37]/25"
                          >
                            {exp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#656d76] italic">No explicit exports</span>
                    )}
                  </div>

                  {/* Extracted Imports (Blue Pills) */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76] mb-1.5">
                      Extracted Imports ({selectedFile.imports?.length || 0})
                    </h4>
                    {selectedFile.imports && selectedFile.imports.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedFile.imports.map((imp, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#ddf4ff] text-[#0969da] border border-[#54aeff]/35"
                          >
                            {imp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#656d76] italic">No imports</span>
                    )}
                  </div>

                  {/* Sanitized Function Signatures */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76] mb-1.5">
                      Sanitized Function Signatures ({selectedFile.functionSignatures?.length || 0})
                    </h4>
                    {selectedFile.functionSignatures && selectedFile.functionSignatures.length > 0 ? (
                      <div className="space-y-1">
                        {selectedFile.functionSignatures.map((sig, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1.5 rounded-md bg-[#f6f8fa] border border-[#d0d7de] font-mono text-[11px] text-[#1f2328] flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{sig}</span>
                            <span className="text-[#656d76] shrink-0 text-[10.5px]">
                              {'{ /* body stripped locally */ }'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#656d76] italic">No function signatures</span>
                    )}
                  </div>

                  {/* Syntax-highlighted GitHub Dark JSON Preview */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76] mb-1.5">
                      Outgoing JSON Slice
                    </h4>
                    <pre className="p-3 rounded-lg bg-[#0d1117] text-[#e6edf3] font-mono text-[11px] leading-relaxed overflow-x-auto border border-[#30363d]">
                      <code>{JSON.stringify(selectedFile, null, 2)}</code>
                    </pre>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-[#656d76]">
                  No AST skeleton loaded yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Raw JSON Tab */
          <div className="p-4 flex-1 overflow-auto bg-[#0d1117] text-[#e6edf3] font-mono text-xs leading-relaxed">
            <pre className="overflow-x-auto selection:bg-[#1f6feb] selection:text-white">
              <code>{jsonString}</code>
            </pre>
          </div>
        )}

        {/* 4. Footer */}
        <div className="px-5 py-3 border-t border-[#d0d7de] bg-[#f6f8fa] flex items-center justify-between text-xs text-[#656d76]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#1a7f37]" />
            <span>
              Web-Tree-Sitter local AST sanitization verified • Commit{' '}
              <code className="font-mono text-[#1f2328] font-medium">
                {skeleton?.commitSha ? skeleton.commitSha.slice(0, 7) : 'local'}
              </code>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#24292f] hover:bg-[#1f2328] text-white rounded-md font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
