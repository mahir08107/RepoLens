'use client';
import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import TopBar from "@/frontend/src/components/TopBar";
import ChatSidebar from "@/components/ChatSidebar";
import PayloadInspector from "@/frontend/src/components/privacy/PayloadInspector";
import {
  MOCK_REPO_SKELETON,
  MOCK_MERMAID_DEFINITION,
  MOCK_ZONE_COLORS,
} from "@/frontend/src/mocks/mockData";
import {
  Compass,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  GitBranch,
  FileCode2,
  Box,
} from "lucide-react";
import type { RepoSkeleton } from "@/shared/types";
import { parseRepo } from "@/lib/ast-parser";

// Dynamic import with ssr: false ensures browser-only execution for Mermaid
const MermaidCanvas = dynamic(() => import("@/components/MermaidCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
      <div className="animate-pulse text-sm font-medium">Loading architecture canvas...</div>
    </div>
  ),
});

export default function Home() {
  const [skeleton, setSkeleton] = useState<RepoSkeleton | null>(MOCK_REPO_SKELETON);

  useEffect(() => {
    if (typeof window !== "undefined" && MOCK_REPO_SKELETON) {
      (window as any).__REPO_SKELETON__ = MOCK_REPO_SKELETON;
    }
  }, []);
  const [mermaidDef, setMermaidDef] = useState<string>(MOCK_MERMAID_DEFINITION);
  const [legend, setLegend] = useState<Record<string, string>>(MOCK_ZONE_COLORS);
  const [selectedId, setSelectedId] = useState<string | null>("node_app_page");
  const [highlightedIds, setHighlightedIds] = useState<string[]>(["node_app_page", "node_lib_parser", "node_back_map"]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // Load sample demo instantly on first load
  const handleLoadDemo = useCallback(() => {
    setSkeleton(MOCK_REPO_SKELETON);
    setMermaidDef(MOCK_MERMAID_DEFINITION);
    setLegend(MOCK_ZONE_COLORS);
    setSelectedId("node_app_page");
    setHighlightedIds(["node_app_page", "node_lib_parser", "node_back_map"]);
    setError(null);
  }, []);

  const handleGenerate = async (url: string) => {
    setLoading(true);
    setStatusText("Fetching repo tree & stripping bodies...");
    setError(null);

    try {
      // 1. Client-side AST extraction with privacy preservation
      let extractedSkeleton: RepoSkeleton | null = null;
      try {
        extractedSkeleton = await parseRepo(url);
        setSkeleton(extractedSkeleton);
        if (typeof window !== "undefined") {
          (window as any).__REPO_SKELETON__ = extractedSkeleton;
        }
      } catch (astErr: any) {
        console.warn("Client AST parsing notice:", astErr.message);
      }

      // 2. Call diagram generation endpoint with repoUrl and extracted skeleton
      setStatusText("Generating architecture map...");
      const response = await fetch("/api/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url, skeleton: extractedSkeleton }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Diagram generation failed");

      if (data.mermaidDefinition) {
        setMermaidDef(data.mermaidDefinition);
      }

      if (data.groupColors) {
        setLegend(data.groupColors);
      }

      const activeSkeleton = extractedSkeleton || data.skeleton;
      if (activeSkeleton) {
        setSkeleton(activeSkeleton);
        if (typeof window !== "undefined") {
          (window as any).__REPO_SKELETON__ = activeSkeleton;
        }
      }

      // Update selected node to the new repo's entrypoint or first module
      const firstFile = activeSkeleton?.files?.[0]?.filePath;
      const newSelectedId = data.entryNodeId || (firstFile ? "node_" + firstFile.replace(/[^a-zA-Z0-9_]/g, "_") : null);
      setSelectedId(newSelectedId);
      setHighlightedIds(newSelectedId ? [newSelectedId] : []);
    } catch (e: any) {
      console.error("Generate error:", e);
      setError(`Failed to generate representation: ${e.message}`);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedId(id);
    setHighlightedIds([id]);
  }, []);

  const handleHighlightFromChat = useCallback((ids: string[]) => {
    setHighlightedIds(ids);
  }, []);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-100 overflow-hidden text-slate-900 font-sans">
      {/* 1. Top Navigation Bar */}
      <TopBar
        onGenerate={handleGenerate}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onLoadDemo={handleLoadDemo}
        loading={loading}
        statusText={statusText}
        error={error}
      />

      {/* 2. Color-Coded Functional Zones Legend Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-2 flex items-center justify-between text-xs z-20 shrink-0">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
            Architecture Zones:
          </span>
        </div>

        <div className="flex items-center space-x-3 overflow-x-auto py-0.5 no-scrollbar">
          {Object.entries(legend).map(([zone, color]) => (
            <div
              key={zone}
              onClick={() => handleNodeSelect(zone.toLowerCase())}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/70 cursor-pointer transition-colors shadow-2xs"
            >
              <span
                className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-xs"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-slate-700 text-[11px]">{zone}</span>
            </div>
          ))}
        </div>

        <div className="hidden lg:flex items-center space-x-2 text-slate-500 text-[11px]">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Client AST Engine Ready</span>
          </span>
        </div>
      </div>

      {/* 3. Main Split Workspace (70% Left Canvas / 30% Right Copilot Drawer) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-3">
        {/* Left Interactive Canvas Area (70%) */}
        <section className="flex-1 flex flex-col min-w-0 h-full relative">
          {mermaidDef ? (
            <MermaidCanvas
              definition={mermaidDef}
              selectedId={selectedId}
              highlightedIds={highlightedIds}
              onNodeSelect={handleNodeSelect}
            />
          ) : (
            <div className="w-full h-full bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                <Compass className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">No Repository Loaded</h2>
              <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                Enter any public GitHub URL above or load a sample architecture map to explore modules, call chains, and functional zones.
              </p>
              <button
                onClick={handleLoadDemo}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md active:scale-98"
              >
                <span>Load Sample Repository</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* Right Chat Copilot Sidebar (30%) */}
        <aside className="w-full md:w-[380px] lg:w-[420px] h-full shrink-0 flex flex-col">
          <ChatSidebar
            repoSkeleton={skeleton}
            selectedId={selectedId}
            onSelectionClear={() => {
              setSelectedId(null);
              setHighlightedIds([]);
            }}
            onHighlightNodes={handleHighlightFromChat}
          />
        </aside>
      </main>

      {/* 4. Jury Privacy Proof Modal (Phase 4) */}
      <PayloadInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        skeleton={skeleton}
      />
    </div>
  );
}
