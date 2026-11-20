'use client';
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import TopBar from "@/frontend/src/components/TopBar";
import ChatSidebar from "@/components/ChatSidebar";
import NodeInspector from "@/components/NodeInspector";
import PayloadInspector from "@/frontend/src/components/privacy/PayloadInspector";
import {
  MOCK_REPO_SKELETON,
  MOCK_MERMAID_DEFINITION,
  MOCK_ZONE_COLORS,
} from "@/frontend/src/mocks/mockData";
import {
  Layers,
  Search,
  X,
  RotateCcw,
  ArrowUpRight,
  Monitor,
} from "lucide-react";
import type { ArchitectureMap, RepoSkeleton } from "@/shared/types";
import { parseRepo } from "@/lib/ast-parser";
import { useAuth } from "@/components/AuthProvider";
import { buildNodeRegistry } from "@/lib/node-registry";
import {
  buildProgressiveMermaidDiagram,
  generateMermaidDiagram,
  convertArchitectureMapToMermaid,
} from "@/lib/diagram-generator";
import { API_BASE_URL } from "@/lib/api-config";
import type { FocusRequest } from "@/components/MermaidCanvas";

const MermaidCanvas = dynamic(() => import("@/components/MermaidCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#f6f8fa] text-[#656d76]">
      <div className="animate-pulse text-sm font-medium">Loading architecture canvas...</div>
    </div>
  ),
});

export default function DashboardWorkspace() {
  const searchParams = useSearchParams();
  const initialRepoParam = searchParams.get("repo");
  const { user, githubAccessToken, signInWithGithub } = useAuth();

  const [activeRepoUrl, setActiveRepoUrl] = useState<string>(initialRepoParam || "");
  const [skeleton, setSkeleton] = useState<RepoSkeleton | null>(null);
  const [architectureMap, setArchitectureMap] = useState<ArchitectureMap | null>(null);
  const [mermaidDef, setMermaidDef] = useState<string>("");
  const [legend, setLegend] = useState<Record<string, string>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [showMobileDesktopBanner, setShowMobileDesktopBanner] = useState<boolean>(true);

  const [activeZoneFilter, setActiveZoneFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "expanded">("expanded");
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [isNeighborhoodFocused, setIsNeighborhoodFocused] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autoLaunchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && MOCK_REPO_SKELETON) {
      (window as any).__REPO_SKELETON__ = MOCK_REPO_SKELETON;
    }
  }, []);

  const progressiveDiagram = useMemo(
    () =>
      buildProgressiveMermaidDiagram({
        skeleton,
        architectureMap,
        baseMermaidDef: mermaidDef,
        viewMode,
        expandedZones,
      }),
    [skeleton, architectureMap, mermaidDef, viewMode, expandedZones]
  );

  const effectiveMermaidDef = progressiveDiagram.mermaidDefinition;

  const registry = useMemo(
    () => buildNodeRegistry(effectiveMermaidDef, skeleton, architectureMap),
    [effectiveMermaidDef, skeleton, architectureMap]
  );

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    if (registry.byId.has(selectedId)) return registry.byId.get(selectedId)!;
    const resolvedId = registry.resolve(selectedId);
    if (resolvedId && registry.byId.has(resolvedId)) return registry.byId.get(resolvedId)!;
    return (
      registry.nodes.find(
        (n) =>
          n.id === selectedId ||
          n.archId === selectedId ||
          (n.filePath && n.filePath.endsWith(selectedId)) ||
          (selectedId && selectedId.endsWith(n.id))
      ) || null
    );
  }, [selectedId, registry]);

  const activeZones = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>();
    registry.nodes.forEach((n) => {
      const z = n.zone || "Services";
      const existing = map.get(z);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(z, {
          count: 1,
          color: legend[z] || MOCK_ZONE_COLORS[z] || "#0969da",
        });
      }
    });
    return Array.from(map.entries())
      .filter(([_, d]) => d.count > 0)
      .map(([zone, d]) => ({ zone, count: d.count, color: d.color }));
  }, [registry, legend]);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return registry.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.filePath.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.zone.toLowerCase().includes(q)
    );
  }, [searchQuery, registry]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsCopilotOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setActiveZoneFilter(null);
        setHighlightedIds([]);
        setIsNeighborhoodFocused(false);
        setIsSearchOpen(false);
      }
      if (e.key === '0' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSelectedId(null);
        setActiveZoneFilter(null);
        setHighlightedIds([]);
        setFocusRequest({ id: '__RESET__', nonce: Date.now() });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLoadDemo = useCallback(() => {
    setSkeleton(MOCK_REPO_SKELETON);
    setArchitectureMap(null);
    setMermaidDef(MOCK_MERMAID_DEFINITION);
    setLegend(MOCK_ZONE_COLORS);
    setSelectedId(null);
    setActiveZoneFilter(null);
    setHighlightedIds([]);
    setFocusRequest({ id: '__RESET__', nonce: Date.now() });
    setError(null);
  }, []);

  const handleGenerate = useCallback(async (url: string) => {
    setActiveRepoUrl(url);
    setLoading(true);
    setStatusText("Fetching repo tree & stripping bodies locally...");
    setError(null);

    try {
      let extractedSkeleton: RepoSkeleton | null = null;
      try {
        const token = githubAccessToken || undefined;
        extractedSkeleton = await Promise.race([
          parseRepo(url, token),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Client AST parse timeout")), 10000)
          ),
        ]);
        if (extractedSkeleton) {
          setSkeleton(extractedSkeleton);
          if (typeof window !== "undefined") {
            (window as any).__REPO_SKELETON__ = extractedSkeleton;
          }
        }
      } catch (astErr: any) {
        console.warn("Client AST parsing notice (proceeding with server diagram generation):", astErr.message);
      }

      setStatusText("Generating architecture map...");
      const apiBase =
        (typeof process !== "undefined" &&
          (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL)) ||
        API_BASE_URL ||
        "";
      const targetUrl = apiBase ? `${apiBase.replace(/\/+$/, "")}/api/generate-map` : "/api/generate-map";

      let data: any = null;
      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl: url,
            commitSha: extractedSkeleton?.commitSha || "latest",
            skeleton: extractedSkeleton,
            files: extractedSkeleton?.files || [],
          }),
        });

        const json = await response.json().catch(() => null);

        if (!response.ok) {
          const errDetail =
            json && typeof json === "object" && json.error
              ? json.error
              : `Backend returned HTTP ${response.status}`;
          throw new Error(errDetail);
        }

        if (json && typeof json === "object") {
          if (json.error) {
            throw new Error(json.error);
          }
          data = json;
        }
      } catch (backendErr: any) {
        console.warn("Backend /api/generate-map notice:", backendErr?.message);
        if (backendErr?.message && !backendErr.message.includes("fetch")) {
          setError(backendErr.message);
        }
      }

      const activeSkeleton =
        extractedSkeleton ||
        (data && typeof data === "object" ? data.skeleton || data : null);

      if (activeSkeleton) {
        setSkeleton(activeSkeleton);
        if (typeof window !== "undefined") {
          (window as any).__REPO_SKELETON__ = activeSkeleton;
        }
      }

      // Safe resolution of architectureMap with strict null-safety
      const rawArchMap =
        data && typeof data === "object" ? data.architectureMap || data : null;
      const hasValidNodes =
        rawArchMap &&
        typeof rawArchMap === "object" &&
        Array.isArray(rawArchMap.nodes) &&
        rawArchMap.nodes.length > 0;

      if (hasValidNodes) {
        setArchitectureMap(rawArchMap);
        if (activeSkeleton) {
          const converted = convertArchitectureMapToMermaid(rawArchMap, activeSkeleton);
          if (converted.mermaidDefinition) {
            setMermaidDef(converted.mermaidDefinition);
            setLegend(converted.groupColors);
          }
        }
      } else if (data && typeof data === "object" && data.mermaidDefinition) {
        setMermaidDef(data.mermaidDefinition);
        if (data.groupColors) {
          setLegend(data.groupColors);
        }
        if (data.architectureMap && typeof data.architectureMap === "object") {
          setArchitectureMap(data.architectureMap);
        } else {
          setArchitectureMap(null);
        }
      } else if (activeSkeleton) {
        // High-fidelity algorithmic fallback so map always renders even if backend is waking up or 0 AST
        const fallback = generateMermaidDiagram(activeSkeleton);
        setMermaidDef(fallback.mermaidDefinition);
        setLegend(fallback.groupColors);
        setArchitectureMap(null);
      } else {
        throw new Error(
          (data && typeof data === "object" && data.error) ||
            "Could not parse repository files. Please verify the repository URL."
        );
      }

      // Safe file count calculation - NEVER access data.architectureMap when data is null/undefined
      const fileCount =
        (hasValidNodes ? rawArchMap.nodes.length : 0) ||
        (activeSkeleton && Array.isArray(activeSkeleton.files) ? activeSkeleton.files.length : 0);
      setViewMode(fileCount > 14 ? "overview" : "expanded");
      setExpandedZones(new Set());
      setIsNeighborhoodFocused(false);
      setSelectedId(null);
      setActiveZoneFilter(null);
      setHighlightedIds([]);
      setFocusRequest({ id: '__RESET__', nonce: Date.now() });
    } catch (e: any) {
      console.error("Generate error:", e);
      setError(`Failed to generate representation: ${e.message}`);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }, [githubAccessToken]);

  // Auto-analyze if launched via /dashboard?repo=...
  useEffect(() => {
    if (initialRepoParam && autoLaunchedRef.current !== initialRepoParam) {
      autoLaunchedRef.current = initialRepoParam;
      handleGenerate(initialRepoParam);
    }
  }, [initialRepoParam, handleGenerate]);

  const handleNodeSelect = useCallback(
    (id: string) => {
      // Clicking a collapsed Zone Cluster card expands that zone in place
      if (id.startsWith("zone_cluster_")) {
        const zoneKey = id.replace(/^zone_cluster_/, "");
        setExpandedZones((prev) => {
          const next = new Set(prev);
          next.add(zoneKey);
          return next;
        });
        return;
      }

      const canonical = registry.resolve(id) || id;
      setSelectedId(canonical);
      setIsNeighborhoodFocused(false);
      setFocusRequest({ id: canonical, nonce: Date.now() });
    },
    [registry]
  );

  const handleToggleNeighborhoodFocus = useCallback(() => {
    if (!selectedNode) return;
    if (isNeighborhoodFocused) {
      setIsNeighborhoodFocused(false);
      setHighlightedIds([]);
    } else {
      const neighbors = new Set<string>([selectedNode.id]);
      registry.incoming(selectedNode.id).forEach((e) => neighbors.add(e.source));
      registry.outgoing(selectedNode.id).forEach((e) => neighbors.add(e.target));
      setHighlightedIds(Array.from(neighbors));
      setIsNeighborhoodFocused(true);
    }
  }, [selectedNode, isNeighborhoodFocused, registry]);

  const handleHighlightFromChat = useCallback(
    (ids: string[]) => {
      const resolved = ids
        .map((id) => registry.resolve(id))
        .filter((id): id is string => Boolean(id));
      setHighlightedIds(resolved);
    },
    [registry]
  );

  const handleFocusNodeFromChat = useCallback(
    (nodeId: string, highlightGroup?: string[]) => {
      const canonical = registry.resolve(nodeId) || nodeId;
      setSelectedId(canonical);
      setFocusRequest({ id: canonical, nonce: Date.now() });
      if (highlightGroup && highlightGroup.length > 0) {
        const resolved = highlightGroup
          .map((id) => registry.resolve(id))
          .filter((id): id is string => Boolean(id));
        setHighlightedIds(resolved);
      }
    },
    [registry]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedId(null);
    setActiveZoneFilter(null);
    setHighlightedIds([]);
    setIsNeighborhoodFocused(false);
    setFocusRequest({ id: '__RESET__', nonce: Date.now() });
  }, []);

  const handleZoneFilter = (zoneName: string | null) => {
    if (!zoneName || activeZoneFilter === zoneName) {
      setActiveZoneFilter(null);
      setHighlightedIds([]);
      setSelectedId(null);
      setFocusRequest({ id: '__RESET__', nonce: Date.now() });
      return;
    }

    setActiveZoneFilter(zoneName);
    const zoneNodeIds = registry.nodes
      .filter((n) => n.zone?.toLowerCase() === zoneName.toLowerCase())
      .map((n) => n.id);

    setHighlightedIds(zoneNodeIds);
    if (zoneNodeIds.length > 0) {
      setSelectedId(zoneNodeIds[0]);
      setFocusRequest({ id: zoneNodeIds[0], nonce: Date.now() });
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#ffffff] overflow-hidden text-[#1f2328] font-sans">
      <TopBar
        onGenerate={handleGenerate}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onLoadDemo={handleLoadDemo}
        loading={loading}
        statusText={statusText}
        error={error}
        isCopilotOpen={isCopilotOpen}
        onToggleCopilot={() => setIsCopilotOpen((v) => !v)}
        hasActiveSelection={Boolean(selectedNode)}
        initialRepoUrl={activeRepoUrl}
      />

      {/* Subtle Dismissible "Best on Desktop" Notice Banner (Mobile < 768px only) */}
      {showMobileDesktopBanner && (
        <div className="md:hidden bg-[#18181B] text-[#FAFAFA] border-b border-[#27272A] px-4 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Monitor className="w-4 h-4 text-[#A1A1AA] shrink-0" />
            <span className="leading-snug text-[#E4E4E7]">
              Interactive dependency graphs are best experienced on a desktop screen. Pinch or drag to pan.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowMobileDesktopBanner(false)}
            className="text-[#A1A1AA] hover:text-white font-mono text-[11px] shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Dismiss</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {effectiveMermaidDef && (
      <div className="h-[44px] min-h-[44px] bg-[#ffffff] border-b border-[#E4E4E7] px-4 flex items-center justify-between text-xs z-20 shrink-0 gap-3 select-none">
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 flex-1 min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center space-x-1.5 shrink-0 pr-1.5 border-r border-[#d0d7de]">
            <Layers className="w-3.5 h-3.5 text-[#656d76]" />
            <span className="font-semibold text-[#656d76] uppercase tracking-wider text-[10px]">
              Zones:
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleZoneFilter(null)}
            className={`h-7 flex items-center space-x-1.5 px-2.5 rounded-md text-[11px] font-medium transition-all cursor-pointer shrink-0 border ${
              activeZoneFilter === null
                ? "bg-[#09090B] text-white border-[#09090B] shadow-2xs"
                : "bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#09090B] border-[#E4E4E7]"
            }`}
          >
            <span>All ({registry.nodes.length})</span>
          </button>

          {activeZones.map(({ zone, count, color }) => {
            const isActive = activeZoneFilter === zone;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => handleZoneFilter(zone)}
                className={`h-7 flex items-center space-x-1.5 px-2.5 rounded-md text-[11px] font-medium transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? "bg-[#09090B] text-white border-[#09090B] font-semibold"
                    : "bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#09090B] border-[#E4E4E7]"
                }`}
                title={`Isolate ${zone} modules (${count})`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="whitespace-nowrap">
                  {zone} ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative shrink-0 flex items-center">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#656d76] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredNodes.length > 0) {
                  e.preventDefault();
                  handleNodeSelect(filteredNodes[0].id);
                  setIsSearchOpen(false);
                } else if (e.key === "Escape") {
                  setIsSearchOpen(false);
                }
              }}
              className="h-7 pl-8 pr-12 text-xs bg-[#f6f8fa] hover:bg-white focus:bg-white border border-[#d0d7de] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0969da] focus:border-[#0969da] w-48 sm:w-64 transition-all shadow-2xs font-mono text-[#1f2328] placeholder-[#656d76]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="absolute right-2 p-0.5 text-[#656d76] hover:text-[#1f2328] rounded-full transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <kbd className="absolute right-2 pointer-events-none text-[10px] font-mono text-[#656d76] bg-white border border-[#d0d7de] px-1 rounded">
                ⌘K
              </kbd>
            )}
          </div>

          {isSearchOpen && searchQuery && (
            <div className="absolute top-full right-0 mt-1.5 w-84 max-h-72 overflow-y-auto bg-white border border-[#d0d7de] rounded-xl shadow-xl z-50 p-1.5 space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[#656d76] flex justify-between border-b border-[#d0d7de]">
                <span>Matching Modules ({filteredNodes.length})</span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[#656d76] hover:text-[#1f2328] cursor-pointer"
                >
                  Close
                </button>
              </div>
              {filteredNodes.length > 0 ? (
                filteredNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      handleNodeSelect(n.id);
                      setIsSearchOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#ddf4ff] hover:border-[#54aeff]/30 border border-transparent transition-all flex flex-col gap-0.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1f2328] text-xs truncate">{n.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f6f8fa] text-[#656d76] border border-[#d0d7de] font-medium">
                        {n.zone || "Module"}
                      </span>
                    </div>
                    {n.filePath && (
                      <span className="font-mono text-[10px] text-[#57606a] truncate">{n.filePath}</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-[#656d76]">
                  No modules matching &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-3 bg-[#ffffff]">
        <section className="flex-1 flex flex-col min-w-0 h-full relative">
          {effectiveMermaidDef ? (
            <>
              <MermaidCanvas
                definition={effectiveMermaidDef}
                selectedId={selectedId}
                highlightedIds={highlightedIds}
                edges={registry.edges}
                onNodeSelect={handleNodeSelect}
                onBackgroundClick={handleClearSelection}
                focusRequest={focusRequest}
                viewMode={viewMode}
                isFocusNeighborhood={isNeighborhoodFocused}
                zoneClusterIdToKey={progressiveDiagram.zoneClusterIdToKey}
                subgraphIdToKey={progressiveDiagram.subgraphIdToKey}
                onExpandZone={(zoneKey) => {
                  setExpandedZones((prev) => {
                    const next = new Set(prev);
                    next.add(zoneKey);
                    return next;
                  });
                }}
                onCollapseZone={(zoneKey) => {
                  setExpandedZones((prev) => {
                    const next = new Set(prev);
                    next.delete(zoneKey);
                    return next;
                  });
                }}
                onViewModeChange={(mode) => {
                  setViewMode(mode);
                  if (mode === "overview") setExpandedZones(new Set());
                  setSelectedId(null);
                  setHighlightedIds([]);
                  setIsNeighborhoodFocused(false);
                }}
              />

              {selectedNode && (
                <NodeInspector
                  node={selectedNode}
                  registry={registry}
                  zoneColor={legend[selectedNode.zone] || "#0969da"}
                  onClose={handleClearSelection}
                  onFocusNode={handleNodeSelect}
                  onHighlightGroup={handleHighlightFromChat}
                  onOpenCopilot={() => setIsCopilotOpen(true)}
                  isNeighborhoodFocused={isNeighborhoodFocused}
                  onToggleNeighborhoodFocus={handleToggleNeighborhoodFocus}
                />
              )}

              {(selectedId || activeZoneFilter) && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute bottom-3.5 right-48 z-20 flex items-center space-x-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-[#d0d7de] hover:border-[#0969da] hover:text-[#0969da] rounded-lg text-xs font-medium text-[#1f2328] shadow-xs transition-all cursor-pointer"
                  title="Unselect node / clear zone filter and reset view"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#0969da]" />
                  <span>Reset View</span>
                </button>
              )}
            </>
          ) : (
            <div
              className="w-full h-full bg-[#FAFAFA] rounded-2xl border border-[#E4E4E7] flex flex-col items-center justify-center p-6 relative overflow-hidden"
              style={{
                backgroundImage: "radial-gradient(#E4E4E7 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            >
              <div className="max-w-md w-full bg-white border border-[#D4D4D8] rounded-2xl p-8 text-center shadow-sm">
                {/* Minimal Monochrome 3-Node Architecture Schematic Icon */}
                <div className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl p-3 mx-auto w-fit">
                  <svg
                    viewBox="0 0 40 40"
                    fill="none"
                    className="w-10 h-10 text-[#18181B]"
                    aria-hidden="true"
                  >
                    <rect x="13" y="3" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="#FFFFFF" />
                    <rect x="3" y="27" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="#FFFFFF" />
                    <rect x="23" y="27" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="#FFFFFF" />
                    <path d="M20 12V19M20 19H10V27M20 19H30V27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h2 className="text-lg font-medium tracking-[-0.02em] text-[#09090B] mt-5">
                  Paste a GitHub repository link to map its architecture
                </h2>

                <p className="text-xs text-[#52525B] leading-relaxed mt-2">
                  Enter any public GitHub URL in the bar above—or sign in with GitHub to select from your private and public repositories. All AST parsing runs locally in your browser.
                </p>

                {/* Quick-Start Sample Pills */}
                <div className="mt-6 pt-5 border-t border-[#E4E4E7]">
                  <div className="font-mono text-[10px] tracking-widest text-[#71717A] uppercase">
                    OR TRY AN EXAMPLE REPOSITORY
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {[
                      "expressjs/express",
                      "tiangolo/fastapi",
                      "colinhacks/zod",
                    ].map((repoSlug) => (
                      <button
                        key={repoSlug}
                        type="button"
                        disabled={loading}
                        onClick={() => handleGenerate(`https://github.com/${repoSlug}`)}
                        className="px-3 py-1.5 rounded-full bg-[#F4F4F5] hover:bg-[#09090B] text-[#09090B] hover:text-white border border-[#E4E4E7] hover:border-[#09090B] font-mono text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {repoSlug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional Sign-In Nudge (Only if signed out) */}
                {!user && (
                  <div className="mt-6 pt-4 border-t border-[#E4E4E7] text-xs text-[#71717A] flex items-center justify-center gap-1.5 flex-wrap">
                    <span>Want to map private repositories?</span>
                    <button
                      type="button"
                      onClick={() => signInWithGithub().catch(() => {})}
                      className="inline-flex items-center gap-0.5 text-[#09090B] font-medium underline underline-offset-4 hover:opacity-80 cursor-pointer"
                    >
                      <span>Sign in with GitHub</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {isCopilotOpen && (
          <aside className="fixed inset-x-0 bottom-0 h-[72vh] z-40 shadow-2xl md:static md:w-[400px] md:h-full md:shadow-none shrink-0 flex flex-col animate-in slide-in-from-bottom-4 md:slide-in-from-right-4 duration-200">
            <ChatSidebar
              repoSkeleton={skeleton}
              repoUrl={architectureMap?.repoUrl || skeleton?.repoUrl || null}
              commitSha={architectureMap?.commitSha || skeleton?.commitSha || null}
              selectedNode={selectedNode}
              registry={registry}
              onSelectionClear={handleClearSelection}
              onHighlightNodes={handleHighlightFromChat}
              onFocusNode={handleFocusNodeFromChat}
              onClose={() => setIsCopilotOpen(false)}
            />
          </aside>
        )}
      </main>

      <PayloadInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        skeleton={skeleton}
      />
    </div>
  );
}

