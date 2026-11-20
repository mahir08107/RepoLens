'use client';
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, RotateCcw, Download, Check, MousePointerClick, Map as MapIcon, Eye, EyeOff } from "lucide-react";
import type { CanvasEdge } from "@/lib/node-registry";

export interface FocusRequest {
  id: string;
  nonce: number;
}

interface MermaidCanvasProps {
  definition: string;
  highlightedIds?: string[];
  selectedId?: string | null;
  /** Node-level edges (from the node registry) used to light up a selection's connections. */
  edges?: CanvasEdge[];
  onNodeSelect: (id: string) => void;
  /** Fired on a click (not a drag) on empty canvas space. */
  onBackgroundClick?: () => void;
  /** Pan and zoom the canvas so this node is centred, or '__RESET__' to fit entire diagram. */
  focusRequest?: FocusRequest | null;
  /** Progressive disclosure view mode */
  viewMode?: "overview" | "expanded";
  onViewModeChange?: (mode: "overview" | "expanded") => void;
  /** 1-Hop Focus Neighborhood isolation mode */
  isFocusNeighborhood?: boolean;
  /** Expand or collapse a specific zone cluster in Overview mode */
  onExpandZone?: (zoneKey: string) => void;
  onCollapseZone?: (zoneKey: string) => void;
}

interface MiniNodeRect {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zone?: string;
}

interface MiniClusterRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const DRAG_THRESHOLD_PX = 5;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Extracts the user-defined node ID from any Mermaid rendered <g class="node">.
 * Handles prefixes like 'flowchart-<nodeId>-<number>'.
 */
function canonicalNodeId(el: Element): string {
  const dataId = el.getAttribute("data-id");
  if (dataId) return dataId;
  const raw = el.id || "";
  const match = raw.match(/^flowchart-(.+)-\d+$/);
  if (match) return match[1];
  return raw.replace(/^flowchart-/, "").replace(/-\d+$/, "");
}

/** Safely traverses upwards through foreignObject boundaries to locate parent <g class="node">. */
function findNodeElement(target: EventTarget | null): Element | null {
  let curr = target as Node | null;
  while (curr && curr !== document.body) {
    if (curr instanceof Element) {
      if (curr.classList?.contains("node") || curr.hasAttribute("data-rl-id")) {
        return curr;
      }
    }
    curr = curr.parentNode;
  }
  return null;
}

/** Robust fuzzy matching for a node <g> element inside the rendered SVG. */
function findNodeInSvg(svg: SVGSVGElement, targetId: string): Element | null {
  const allNodes = Array.from(svg.querySelectorAll("g.node"));
  if (!targetId) return null;
  const targetLower = targetId.toLowerCase().trim();

  // 1. Direct match by data-rl-id or canonicalNodeId
  for (const n of allNodes) {
    const id = n.getAttribute("data-rl-id") || canonicalNodeId(n);
    if (id === targetId || id.toLowerCase() === targetLower) return n;
  }
  // 2. Affix matching (e.g. node_app_page vs app_page)
  for (const n of allNodes) {
    const id = (n.getAttribute("data-rl-id") || canonicalNodeId(n)).toLowerCase();
    const cleanId = id.replace(/^node_/, "");
    const cleanTarget = targetLower.replace(/^node_/, "");
    if (cleanId === cleanTarget || id.endsWith(targetLower) || targetLower.endsWith(id)) {
      return n;
    }
  }
  // 3. Match by text label inside node
  for (const n of allNodes) {
    const text = n.textContent?.toLowerCase() || "";
    if (text.includes(targetLower)) return n;
  }
  return null;
}

function linkMatchesEdge(el: Element, edge: CanvasEdge): boolean {
  const id = el.id || el.getAttribute("data-id") || "";
  const cls = el.getAttribute("class") || "";
  return (
    id.includes(`L_${edge.source}_${edge.target}_`) ||
    id.includes(`L-${edge.source}-${edge.target}`) ||
    (cls.includes(`LS-${edge.source}`) && cls.includes(`LE-${edge.target}`))
  );
}

/**
 * Calculates a node's center coordinate in unscaled SVG / world coordinates.
 */
function getNodeWorldCenter(svg: SVGSVGElement, nodeEl: Element): { x: number; y: number } | null {
  try {
    const graphicsEl = nodeEl as SVGGraphicsElement;
    const localBBox = graphicsEl.getBBox();
    const localCenterX = localBBox.x + localBBox.width / 2;
    const localCenterY = localBBox.y + localBBox.height / 2;

    const pt = svg.createSVGPoint();
    pt.x = localCenterX;
    pt.y = localCenterY;

    const nodeCTM = graphicsEl.getScreenCTM();
    const svgCTM = svg.getScreenCTM();
    if (nodeCTM && svgCTM) {
      const screenPt = pt.matrixTransform(nodeCTM);
      const worldPt = screenPt.matrixTransform(svgCTM.inverse());
      return { x: worldPt.x, y: worldPt.y };
    }
  } catch (err) {
    console.warn("getNodeWorldCenter CTM failed, falling back to getBBox", err);
  }

  try {
    const b = (nodeEl as SVGGraphicsElement).getBBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  } catch {
    return null;
  }
}

const getMermaid = () => ((mermaid as any)?.default || mermaid) as typeof mermaid;

const MermaidCanvas: React.FC<MermaidCanvasProps> = ({
  definition,
  highlightedIds = [],
  selectedId = null,
  edges = [],
  onNodeSelect,
  onBackgroundClick,
  focusRequest = null,
  viewMode = "expanded",
  onViewModeChange,
  isFocusNeighborhood = false,
  onExpandZone,
  onCollapseZone,
}) => {
  const onExpandZoneRef = useRef(onExpandZone);
  onExpandZoneRef.current = onExpandZone;
  const onCollapseZoneRef = useRef(onCollapseZone);
  onCollapseZoneRef.current = onCollapseZone;
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas zoom scale
  const [zoom, setZoom] = useState<number>(1.0);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Viewport scroll offset
  const [scrollPos, setScrollPos] = useState({ scrollLeft: 0, scrollTop: 0 });
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 600 });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0, moved: false, active: false });

  const [renderError, setRenderError] = useState<string | null>(null);
  const [svgVersion, setSvgVersion] = useState(0);
  const [exported, setExported] = useState(false);

  // Live diagram geometry in world coordinates
  const [svgBBox, setSvgBBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 1000,
    height: 600,
  });
  const svgBBoxRef = useRef(svgBBox);
  svgBBoxRef.current = svgBBox;
  const [nodeRects, setNodeRects] = useState<MiniNodeRect[]>([]);
  const [clusterRects, setClusterRects] = useState<MiniClusterRect[]>([]);

  // Mini-Map Controls
  const [miniMapVisible, setMiniMapVisible] = useState(true);
  const miniDragRef = useRef({ active: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 });

  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const lastHandledFocusRef = useRef<string | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Track viewport container dimensions
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize((prev) => {
        if (prev.width === el.clientWidth && prev.height === el.clientHeight) return prev;
        return { width: el.clientWidth, height: el.clientHeight };
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize mermaid once with clean GitHub-neutral font and styling
  useEffect(() => {
    try {
      getMermaid().initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        flowchart: {
          curve: "basis",
          nodeSpacing: 50,
          rankSpacing: 70,
          useMaxWidth: false,
          htmlLabels: true,
        },
      });
    } catch (e) {
      console.warn("Mermaid initialize warning:", e);
    }
  }, []);

  // Scaled dimensions & scrollable spacer
  const spacerWidth = Math.max(containerSize.width, svgBBox.width * zoom + 600);
  const spacerHeight = Math.max(containerSize.height, svgBBox.height * zoom + 600);

  // Position diagram at center of spacer
  const diagramOriginX = (spacerWidth - svgBBox.width * zoom) / 2 - svgBBox.x * zoom;
  const diagramOriginY = (spacerHeight - svgBBox.height * zoom) / 2 - svgBBox.y * zoom;

  // Fit the whole diagram into the canvas viewport with 48px padding
  const fitToView = useCallback((smooth = true) => {
    const vp = viewportRef.current;
    const svg = containerRef.current?.querySelector("svg");
    if (!vp || !svg) return;

    const cW = vp.clientWidth;
    const cH = vp.clientHeight;
    if (cW <= 0 || cH <= 0) return;

    let bBox = { x: 0, y: 0, width: 1000, height: 600 };
    try {
      const b = (svg as SVGGraphicsElement).getBBox();
      if (b.width > 0 && b.height > 0) {
        bBox = { x: b.x, y: b.y, width: b.width, height: b.height };
      } else {
        const vb = svg.viewBox?.baseVal;
        bBox = { x: vb?.x || 0, y: vb?.y || 0, width: vb?.width || 1000, height: vb?.height || 600 };
      }
    } catch {
      const vb = svg.viewBox?.baseVal;
      bBox = { x: vb?.x || 0, y: vb?.y || 0, width: vb?.width || 1000, height: vb?.height || 600 };
    }

    setSvgBBox((prev) => {
      if (prev.x === bBox.x && prev.y === bBox.y && prev.width === bBox.width && prev.height === bBox.height) {
        return prev;
      }
      return bBox;
    });

    const padding = 48; // 48px padding
    const availWidth = Math.max(cW - padding * 2, 100);
    const availHeight = Math.max(cH - padding * 2, 100);

    const fitZoom = clampZoom(Math.min(availWidth / bBox.width, availHeight / bBox.height, 1.05));
    setZoom((prev) => (Math.abs(prev - fitZoom) < 0.001 ? prev : fitZoom));

    // Calculate new spacer dimensions at fitZoom
    const newSpacerW = Math.max(cW, bBox.width * fitZoom + 600);
    const newSpacerH = Math.max(cH, bBox.height * fitZoom + 600);
    const newOriginX = (newSpacerW - bBox.width * fitZoom) / 2 - bBox.x * fitZoom;
    const newOriginY = (newSpacerH - bBox.height * fitZoom) / 2 - bBox.y * fitZoom;

    const svgCenterX = bBox.x + bBox.width / 2;
    const svgCenterY = bBox.y + bBox.height / 2;

    const targetScrollLeft = newOriginX + svgCenterX * fitZoom - cW / 2;
    const targetScrollTop = newOriginY + svgCenterY * fitZoom - cH / 2;

    if (smooth) {
      vp.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: 'smooth' });
    } else {
      vp.scrollLeft = targetScrollLeft;
      vp.scrollTop = targetScrollTop;
    }
  }, []);

  // Render diagram and extract live node/cluster bounding rects for mini-map
  useEffect(() => {
    if (!definition || !containerRef.current) return;
    let cancelled = false;

    const render = async () => {
      setRenderError(null);
      try {
        let renderedSvg: string;
        try {
          const res = await getMermaid().render(`mermaid-canvas-${Date.now()}`, definition);
          renderedSvg = res.svg;
        } catch (initialErr: any) {
          // Defensive retry: sanitize stray quotes/characters inside node labels and edge labels
          const sanitizedDef = definition
            .split("\n")
            .map((line) => {
              // Sanitize node label lines: node_id["..."]
              const nodeMatch = line.match(/^(\s*[a-zA-Z0-9_-]+)\["(.*)"\](.*)$/);
              if (nodeMatch) {
                const [, prefix, label, suffix] = nodeMatch;
                const safeLabel = label.replace(/"/g, "'").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;");
                return `${prefix}["${safeLabel}"]${suffix}`;
              }
              // Sanitize edge relations: ==>|"..."|
              const edgeMatch = line.match(/^(\s*[a-zA-Z0-9_-]+\s*(?:==>|-.->)\s*)\|"(.*?)"\|(\s*[a-zA-Z0-9_-]+)$/);
              if (edgeMatch) {
                const [, prefix, rel, target] = edgeMatch;
                const safeRel = rel.replace(/"/g, "'").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;");
                return `${prefix}|"${safeRel}"|${target}`;
              }
              return line;
            })
            .join("\n");

          if (sanitizedDef !== definition) {
            console.warn("Retrying Mermaid render with sanitized definition due to syntax error:", initialErr);
            const res = await getMermaid().render(`mermaid-canvas-${Date.now()}`, sanitizedDef);
            renderedSvg = res.svg;
          } else {
            throw initialErr;
          }
        }

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = renderedSvg;

        const svgEl = containerRef.current.querySelector("svg");
        if (!svgEl) return;

        // 1. Attach safe click listeners to nodes (enforcing drag guard)
        const nodes = svgEl.querySelectorAll("g.node");
        const parsedNodes: MiniNodeRect[] = [];

        nodes.forEach((node) => {
          const id = canonicalNodeId(node);
          node.setAttribute("data-rl-id", id);
          const isZoneCluster =
            id.startsWith("zone_cluster_") ||
            id.startsWith("zone-cluster:") ||
            Boolean(node.textContent?.includes("Expand Zone +"));

          const clickHandler = (e: Event) => {
            e.stopPropagation();
            if (dragRef.current.moved) return;
            if (isZoneCluster) {
              const zoneKey = id.replace(/^zone_cluster_/, "").replace(/^zone-cluster:/, "");
              onExpandZoneRef.current?.(zoneKey);
              return;
            }
            onNodeSelectRef.current(id);
          };

          node.addEventListener("click", clickHandler);
          // Also attach to foreignObject and all its children so inner text clicks fire
          node.querySelectorAll("foreignObject, foreignObject *").forEach((child) => {
            child.addEventListener("click", clickHandler);
          });

          try {
            const pt = getNodeWorldCenter(svgEl, node);
            const b = (node as SVGGraphicsElement).getBBox();
            if (pt) {
              parsedNodes.push({
                id,
                label: node.querySelector(".nodeLabel")?.textContent?.trim() || id,
                x: pt.x - b.width / 2,
                y: pt.y - b.height / 2,
                width: b.width,
                height: b.height,
              });
            }
          } catch {}
        });

        // 2. Extract cluster subgraphs & attach Collapse Zone handler when present
        const clusters = svgEl.querySelectorAll("g.cluster");
        const parsedClusters: MiniClusterRect[] = [];
        clusters.forEach((c) => {
          try {
            const labelText = c.querySelector(".nodeLabel")?.textContent?.trim() || "";
            if (labelText.includes("Collapse Zone")) {
              const clusterEl = c as SVGGElement;
              clusterEl.style.cursor = "pointer";
              const labelEl = c.querySelector(".cluster-label, .nodeLabel, foreignObject");
              if (labelEl) {
                labelEl.addEventListener("click", (e: Event) => {
                  e.stopPropagation();
                  if (dragRef.current.moved) return;
                  const zoneKey = (c.id || "").replace(/^sub_/, "");
                  if (zoneKey) onCollapseZoneRef.current?.(zoneKey);
                });
              }
            }
            const b = (c as SVGGraphicsElement).getBBox();
            parsedClusters.push({
              id: c.id || "cluster",
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              label: labelText,
            });
          } catch {}
        });

        // 2b. Clean up & resize edge labels so they are never clipped
        svgEl.querySelectorAll("g.edgeLabel").forEach((edgeLabelEl) => {
          const gEl = edgeLabelEl as SVGGElement;
          const fo = gEl.querySelector("foreignObject");
          const labelSpan = gEl.querySelector(".edgeLabel, .labelBkg, span, p") as HTMLElement | null;
          const rawText = (labelSpan?.textContent || gEl.textContent || "").trim();
          const cleanedText = rawText.replace(/^\(+|\)+$/g, "").trim();

          if (!cleanedText) {
            gEl.style.display = "none";
            return;
          }

          if (labelSpan && labelSpan.textContent !== cleanedText && labelSpan.children.length === 0) {
            labelSpan.textContent = cleanedText;
          }

          if (fo && labelSpan) {
            try {
              const targetEl = (gEl.querySelector(".labelBkg") as HTMLElement | null) || labelSpan;
              const measuredW = Math.max(targetEl.scrollWidth, targetEl.offsetWidth, cleanedText.length * 6.5);
              const measuredH = Math.max(targetEl.scrollHeight, targetEl.offsetHeight, 18);
              const newW = Math.ceil(measuredW + 16);
              const newH = Math.ceil(measuredH + 6);
              fo.setAttribute("width", String(newW));
              fo.setAttribute("height", String(newH));
              fo.setAttribute("x", String(-newW / 2));
              fo.setAttribute("y", String(-newH / 2));
              fo.style.overflow = "visible";
            } catch {}
          }
        });

        // 3. Capture overall SVG BBox
        let bBox = { x: 0, y: 0, width: 1000, height: 600 };
        try {
          const b = (svgEl as SVGGraphicsElement).getBBox();
          if (b.width > 0 && b.height > 0) {
            bBox = { x: b.x, y: b.y, width: b.width, height: b.height };
          }
        } catch {}

        setSvgBBox(bBox);
        setNodeRects(parsedNodes);
        setClusterRects(parsedClusters);
        setSvgVersion((v) => v + 1);

        setTimeout(() => fitToView(false), 50);
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        if (!cancelled) setRenderError(err?.message || "Syntax error parsing architecture diagram.");
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [definition, fitToView]);

  // Selection ring, AI blast-radius highlights, directional edges and dimming
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;

    const highlighted = new Set(highlightedIds);
    const dimMode = highlighted.size > 0;
    const outgoingNeighbors = new Set<string>();
    const incomingNeighbors = new Set<string>();
    const outgoingEdges: CanvasEdge[] = [];
    const incomingEdges: CanvasEdge[] = [];
    const otherActiveEdges: CanvasEdge[] = [];

    if (selectedId) {
      edges.forEach((e) => {
        if (e.source === selectedId) {
          outgoingEdges.push(e);
          outgoingNeighbors.add(e.target);
        } else if (e.target === selectedId) {
          incomingEdges.push(e);
          incomingNeighbors.add(e.source);
        }
      });
    }

    if (dimMode) {
      edges.forEach((e) => {
        if (
          highlighted.has(e.source) &&
          highlighted.has(e.target) &&
          !outgoingEdges.includes(e) &&
          !incomingEdges.includes(e)
        ) {
          otherActiveEdges.push(e);
        }
      });
    }

    svg.querySelectorAll("g.node").forEach((node) => {
      const id = node.getAttribute("data-rl-id") || canonicalNodeId(node);
      const isSelected = id === selectedId;
      const isOutNeighbor = outgoingNeighbors.has(id);
      const isInNeighbor = incomingNeighbors.has(id);
      const isDirectNeighbor = isOutNeighbor || isInNeighbor;
      const isHighlighted = !isFocusNeighborhood && highlighted.has(id) && !isSelected;

      const isNeighborhoodDimmed =
        isFocusNeighborhood && selectedId !== null && !isSelected && !isDirectNeighbor;
      const isDimmed =
        !isNeighborhoodDimmed &&
        (selectedId !== null || dimMode) &&
        !isSelected &&
        !isHighlighted &&
        !isDirectNeighbor;

      node.classList.toggle("selected-node", isSelected);
      node.classList.toggle("highlighted-node", isHighlighted);
      node.classList.toggle("neighbor-outgoing", isOutNeighbor && (!dimMode || isFocusNeighborhood));
      node.classList.toggle("neighbor-incoming", isInNeighbor && (!dimMode || isFocusNeighborhood));
      node.classList.toggle("dimmed-node", isDimmed);
      node.classList.toggle("neighborhood-dimmed-node", isNeighborhoodDimmed);
    });

    const anySelection = selectedId !== null || dimMode;
    svg.querySelectorAll("path.flowchart-link, g.edgePaths path, g.edgePath path").forEach((link) => {
      const isOut = outgoingEdges.some((e) => linkMatchesEdge(link, e));
      const isIn = incomingEdges.some((e) => linkMatchesEdge(link, e));
      const isOtherActive = !isFocusNeighborhood && otherActiveEdges.some((e) => linkMatchesEdge(link, e));

      const isNeighborhoodHidden =
        isFocusNeighborhood && selectedId !== null && !isOut && !isIn;

      link.classList.toggle("edge-outgoing", isOut);
      link.classList.toggle("edge-incoming", isIn);
      link.classList.toggle("edge-active", isOtherActive);
      link.classList.toggle("edge-dimmed", !isNeighborhoodHidden && anySelection && !isOut && !isIn && !isOtherActive);
      link.classList.toggle("edge-neighborhood-hidden", isNeighborhoodHidden);
    });
  }, [selectedId, highlightedIds, edges, svgVersion, isFocusNeighborhood]);

  // Handle native scroll to update mini-map position (throttled with rAF)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const left = e.currentTarget.scrollLeft;
    const top = e.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollPos((prev) => {
        if (prev.scrollLeft === left && prev.scrollTop === top) return prev;
        return { scrollLeft: left, scrollTop: top };
      });
    });
  };

  // Node-Click / FocusRequest Auto-Zoom Math (Centering in Viewport)
  useEffect(() => {
    if (!focusRequest) return;
    const key = `${focusRequest.id}:${focusRequest.nonce ?? 0}`;
    if (lastHandledFocusRef.current === key) return;
    lastHandledFocusRef.current = key;

    if (focusRequest.id === '__RESET__') {
      fitToView(true);
      return;
    }

    const vp = viewportRef.current;
    const svg = containerRef.current?.querySelector("svg");
    if (!vp || !svg) return;

    const node = findNodeInSvg(svg, focusRequest.id);
    if (!node) return;

    const center = getNodeWorldCenter(svg, node);
    if (!center) return;

    const cW = vp.clientWidth;
    const cH = vp.clientHeight;

    // Do NOT wildly jump zoom levels unless zoomed way out (zoom < 0.85)
    const targetZoom = zoomRef.current < 0.85 ? 1.05 : zoomRef.current;
    setZoom((prev) => (Math.abs(prev - targetZoom) < 0.001 ? prev : targetZoom));

    // Compute updated spacer origin
    const bBox = svgBBoxRef.current;
    const newSpacerW = Math.max(cW, bBox.width * targetZoom + 600);
    const newSpacerH = Math.max(cH, bBox.height * targetZoom + 600);
    const newOriginX = (newSpacerW - bBox.width * targetZoom) / 2 - bBox.x * targetZoom;
    const newOriginY = (newSpacerH - bBox.height * targetZoom) / 2 - bBox.y * targetZoom;

    const targetScrollLeft = newOriginX + center.x * targetZoom - cW / 2;
    const targetScrollTop = newOriginY + center.y * targetZoom - cH / 2;

    const doScroll = () => {
      vp.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: 'smooth' });
    };

    doScroll();
    requestAnimationFrame(() => {
      requestAnimationFrame(doScroll);
    });
  }, [focusRequest, fitToView]);

  // Zoom In / Out Buttons with Center Pinning
  const zoomBy = (delta: number) => {
    const vp = viewportRef.current;
    if (!vp) return;

    const nextZoom = clampZoom(Math.round((zoom + delta) * 100) / 100);
    if (nextZoom === zoom) return;

    const cW = vp.clientWidth;
    const cH = vp.clientHeight;

    // Current center world point
    const currentCenterX = (vp.scrollLeft + cW / 2 - diagramOriginX) / zoom;
    const currentCenterY = (vp.scrollTop + cH / 2 - diagramOriginY) / zoom;

    setZoom(nextZoom);

    // Next spacer dimensions
    const nextSpacerW = Math.max(cW, svgBBox.width * nextZoom + 600);
    const nextSpacerH = Math.max(cH, svgBBox.height * nextZoom + 600);
    const nextOriginX = (nextSpacerW - svgBBox.width * nextZoom) / 2 - svgBBox.x * nextZoom;
    const nextOriginY = (nextSpacerH - svgBBox.height * nextZoom) / 2 - svgBBox.y * nextZoom;

    const nextScrollLeft = nextOriginX + currentCenterX * nextZoom - cW / 2;
    const nextScrollTop = nextOriginY + currentCenterY * nextZoom - cH / 2;

    vp.scrollTo({ left: nextScrollLeft, top: nextScrollTop, behavior: 'smooth' });
  };

  // Canvas Mouse Drag Panning (synchronizes directly with native scrollbars)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const vp = viewportRef.current;
    if (!vp) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: vp.scrollLeft,
      startScrollTop: vp.scrollTop,
      moved: false,
      active: true,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!d.moved) {
      d.moved = true;
      setIsDragging(true);
    }

    vp.scrollLeft = d.startScrollLeft - dx;
    vp.scrollTop = d.startScrollTop - dy;
  };

  const endDrag = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved) return;
    const nodeEl = findNodeElement(e.target);
    if (nodeEl) {
      e.stopPropagation();
      const id = nodeEl.getAttribute("data-rl-id") || canonicalNodeId(nodeEl);
      if (id.startsWith("zone_cluster_") || id.startsWith("zone-cluster:") || nodeEl.textContent?.includes("Expand Zone +")) {
        const zoneKey = id.replace(/^zone_cluster_/, "").replace(/^zone-cluster:/, "");
        onExpandZoneRef.current?.(zoneKey);
        return;
      }
      if (id) {
        onNodeSelectRef.current(id);
      }
      return;
    }
    onBackgroundClick?.();
  };

  const exportSvg = () => {
    try {
      const svg = containerRef.current?.querySelector("svg");
      if (!svg) return;
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      clone.setAttribute("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

      // Remove active highlight & dimmed classes so the exported SVG is clean
      clone
        .querySelectorAll(".dimmed-node, .edge-dimmed, .selected-node, .highlighted-node")
        .forEach((el) => el.classList.remove("dimmed-node", "edge-dimmed", "selected-node", "highlighted-node"));

      let vbX = svgBBoxRef.current.x;
      let vbY = svgBBoxRef.current.y;
      let vbW = Math.max(svgBBoxRef.current.width, 800);
      let vbH = Math.max(svgBBoxRef.current.height, 600);

      const vbAttr = svg.getAttribute("viewBox");
      if (vbAttr) {
        const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          [vbX, vbY, vbW, vbH] = parts;
        }
      } else {
        try {
          const b = (svg as SVGGraphicsElement).getBBox();
          if (b.width > 0 && b.height > 0) {
            vbX = Math.floor(b.x - 20);
            vbY = Math.floor(b.y - 20);
            vbW = Math.ceil(b.width + 40);
            vbH = Math.ceil(b.height + 40);
          }
        } catch {}
      }

      clone.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
      clone.setAttribute("width", String(Math.ceil(vbW)));
      clone.setAttribute("height", String(Math.ceil(vbH)));
      clone.removeAttribute("style");
      clone.style.maxWidth = "none";
      clone.style.backgroundColor = "#ffffff";

      // Embed standalone SVG styling
      const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.textContent = `
        text, span, div, b, small { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        g.node rect, g.node polygon, g.node circle { fill: #ffffff; stroke: #d0d7de; stroke-width: 1.5px; rx: 8px; ry: 8px; }
        g.cluster rect { fill: #f6f8fa; stroke: #d0d7de; stroke-width: 1px; rx: 10px; ry: 10px; fill-opacity: 0.85; }
        path.flowchart-link, g.edgePath path { stroke: #8c959f; stroke-width: 1.5px; fill: none; }
        .nodeLabel { color: #1f2328; font-size: 13px; font-weight: 500; }
      `;
      clone.insertBefore(styleEl, clone.firstChild);

      // Solid white background
      const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("x", String(vbX));
      bgRect.setAttribute("y", String(vbY));
      bgRect.setAttribute("width", String(vbW));
      bgRect.setAttribute("height", String(vbH));
      bgRect.setAttribute("fill", "#ffffff");
      clone.insertBefore(bgRect, styleEl);

      const serialized = new XMLSerializer().serializeToString(clone);
      const data = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
      const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `repolens-architecture-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();

      setExported(true);
      setTimeout(() => setExported(false), 2000);
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5000);
    } catch (err) {
      console.error("Failed to export SVG:", err);
    }
  };

  // ========================================================
  // MINI-MAP GEOMETRY & BIDIRECTIONAL NAVIGATION
  // ========================================================
  const MINI_WIDTH = 180;
  const MINI_HEIGHT = 120;
  const MINI_HEADER_H = 24;
  const MINI_CANVAS_H = MINI_HEIGHT - MINI_HEADER_H;

  const miniScale = useMemo(() => {
    if (svgBBox.width <= 0 || svgBBox.height <= 0) return 0.1;
    return Math.min(
      (MINI_WIDTH - 12) / svgBBox.width,
      (MINI_CANVAS_H - 12) / svgBBox.height
    );
  }, [svgBBox, MINI_WIDTH, MINI_CANVAS_H]);

  const miniOffsetX = (MINI_WIDTH - svgBBox.width * miniScale) / 2;
  const miniOffsetY = (MINI_CANVAS_H - svgBBox.height * miniScale) / 2;

  // Viewport Frame in Mini-Map Space
  const miniViewport = useMemo(() => {
    const vp = viewportRef.current;
    if (!vp || zoom <= 0) return { x: 0, y: 0, width: 0, height: 0 };

    const worldLeft = (scrollPos.scrollLeft - diagramOriginX) / zoom;
    const worldTop = (scrollPos.scrollTop - diagramOriginY) / zoom;
    const worldWidth = containerSize.width / zoom;
    const worldHeight = containerSize.height / zoom;

    const x = miniOffsetX + (worldLeft - svgBBox.x) * miniScale;
    const y = miniOffsetY + (worldTop - svgBBox.y) * miniScale;
    const width = worldWidth * miniScale;
    const height = worldHeight * miniScale;

    return { x, y, width, height };
  }, [scrollPos, diagramOriginX, diagramOriginY, zoom, containerSize, miniOffsetX, miniOffsetY, svgBBox, miniScale]);

  // Mini-Map Click-to-Jump
  const handleMiniMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;

    const worldTargetX = svgBBox.x + (clickX - miniOffsetX) / miniScale;
    const worldTargetY = svgBBox.y + (clickY - miniOffsetY) / miniScale;

    const vp = viewportRef.current;
    if (!vp) return;

    const targetScrollLeft = diagramOriginX + worldTargetX * zoom - containerSize.width / 2;
    const targetScrollTop = diagramOriginY + worldTargetY * zoom - containerSize.height / 2;

    vp.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: 'smooth' });
  };

  // Mini-Map Drag-the-Viewport-Box
  const handleMiniDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vp = viewportRef.current;
    if (!vp) return;

    miniDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: vp.scrollLeft,
      startScrollTop: vp.scrollTop,
    };
  };

  const handleMiniDragMove = (e: React.MouseEvent) => {
    const md = miniDragRef.current;
    if (!md.active) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const dx = e.clientX - md.startX;
    const dy = e.clientY - md.startY;

    const deltaWorldX = dx / miniScale;
    const deltaWorldY = dy / miniScale;

    vp.scrollLeft = md.startScrollLeft + deltaWorldX * zoom;
    vp.scrollTop = md.startScrollTop + deltaWorldY * zoom;
  };

  const handleMiniDragEnd = () => {
    miniDragRef.current.active = false;
  };

  const stopCanvasEvents = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  const isZoomLow = zoom < 0.7;

  return (
    <div
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className="relative w-full h-full min-h-[550px] bg-[#f6f8fa] rounded-2xl border border-[#d0d7de] overflow-hidden flex flex-col select-none"
    >
      {/* 1. Real Scrollable Viewport Container (with thin GitHub Primer scrollbars) */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleContainerClick}
        className={`canvas-viewport flex-1 w-full h-full overflow-auto relative ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#d0d7de #f6f8fa",
        }}
      >
        {/* Dynamic Spacer ensuring smooth horizontal and vertical scrolling */}
        <div
          style={{
            width: spacerWidth,
            height: spacerHeight,
            minWidth: "100%",
            minHeight: "100%",
            position: "relative",
          }}
        >
          {/* Subtle Grid Canvas Pattern inside spacer */}
          <div
            className="absolute inset-0 pointer-events-none opacity-45"
            style={{
              backgroundImage: "radial-gradient(#d0d7de 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Scaled Architecture Diagram Container */}
          <div
            ref={containerRef}
            style={{
              position: "absolute",
              left: diagramOriginX,
              top: diagramOriginY,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              transition: isDragging ? "none" : "transform 150ms ease-out",
            }}
            className={`mermaid-wrapper flex items-center justify-center ${isZoomLow ? "zoom-low" : ""}`}
          />
        </div>
      </div>

      {/* 2. Floating Toolbar Controls (Top-Right) */}
      <div
        {...stopCanvasEvents}
        className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2 cursor-default"
      >
        {onViewModeChange && (
          <div className="flex items-center bg-white/95 backdrop-blur-md border border-[#d0d7de] rounded-lg shadow-2xs p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => onViewModeChange("overview")}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "overview"
                  ? "bg-[#0969da] text-white shadow-2xs"
                  : "text-[#656d76] hover:text-[#1f2328] hover:bg-[#f6f8fa]"
              }`}
              title="Group files by zone/folder (click any zone to expand)"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("expanded")}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "expanded"
                  ? "bg-[#0969da] text-white shadow-2xs"
                  : "text-[#656d76] hover:text-[#1f2328] hover:bg-[#f6f8fa]"
              }`}
              title="Expand all file nodes across every zone"
            >
              Expand All
            </button>
          </div>
        )}

        <div className="flex items-center bg-white/95 backdrop-blur-md border border-[#d0d7de] rounded-lg shadow-2xs p-0.5 space-x-0.5">
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom In"
          className="p-1.5 text-[#1f2328] hover:bg-[#f6f8fa] active:bg-[#eaeef2] rounded-md transition-colors disabled:opacity-35 cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom Out"
          className="p-1.5 text-[#1f2328] hover:bg-[#f6f8fa] active:bg-[#eaeef2] rounded-md transition-colors disabled:opacity-35 cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-3.5 bg-[#d0d7de] mx-0.5" />
        <button
          type="button"
          onClick={() => fitToView(true)}
          title="Fit Architecture Map to Screen (0)"
          className="p-1.5 text-[#1f2328] hover:bg-[#f6f8fa] active:bg-[#eaeef2] rounded-md transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            exportSvg();
          }}
          title="Export as Vector SVG"
          className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-[#1f2328] hover:bg-[#f6f8fa] active:bg-[#eaeef2] rounded-md transition-colors cursor-pointer"
        >
          {exported ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#1f883d]" />
              <span className="text-[#1f883d]">Exported</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-[#656d76]" />
              <span>Export SVG</span>
            </>
          )}
        </button>
        </div>
      </div>

      {/* 3. Bottom-Left: Live Zoom Badge & Navigation Hints */}
      <div className="absolute bottom-3.5 left-3.5 z-20 flex items-center gap-2 pointer-events-none">
        <div className="px-2 py-0.5 bg-white/95 backdrop-blur-md border border-[#d0d7de] rounded-md text-[11px] font-mono text-[#1f2328] font-medium shadow-2xs">
          {Math.round(zoom * 100)}%
        </div>
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 bg-white/95 backdrop-blur-md border border-[#d0d7de] rounded-md text-[11px] text-[#656d76] shadow-2xs">
          <MousePointerClick className="w-3 h-3 text-[#0969da]" />
          <span>Click node to inspect • Scrollbars / Drag to pan</span>
        </div>
      </div>

      {/* 4. Fully Synced, Interactive Mini-Map (Bottom-Right, 180px × 120px) */}
      <div
        {...stopCanvasEvents}
        onMouseMove={handleMiniDragMove}
        onMouseUp={handleMiniDragEnd}
        onMouseLeave={handleMiniDragEnd}
        className="absolute bottom-3.5 right-3.5 z-20 w-[180px] bg-white/95 backdrop-blur-md border border-[#d0d7de] rounded-md shadow-sm overflow-hidden flex flex-col pointer-events-auto transition-all"
      >
        {/* Mini-Map Header */}
        <div className="h-[24px] flex items-center justify-between px-2 bg-[#f6f8fa] border-b border-[#d0d7de] text-[10px] text-[#656d76] font-semibold uppercase tracking-wider select-none">
          <div className="flex items-center gap-1">
            <MapIcon className="w-3 h-3 text-[#0969da]" />
            <span>Mini-Map</span>
          </div>
          <button
            type="button"
            onClick={() => setMiniMapVisible(!miniMapVisible)}
            className="text-[#656d76] hover:text-[#1f2328] p-0.5 rounded cursor-pointer"
            title={miniMapVisible ? "Collapse Mini-Map" : "Expand Mini-Map"}
          >
            {miniMapVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>

        {/* Mini-Map Interactive Canvas */}
        {miniMapVisible && (
          <div className="w-[180px] h-[96px] relative bg-[#f6f8fa] cursor-crosshair">
            <svg
              onClick={handleMiniMapClick}
              width={MINI_WIDTH}
              height={MINI_CANVAS_H}
              className="w-full h-full"
            >
              {/* Clusters / Subgraphs */}
              {clusterRects.map((c, i) => (
                <rect
                  key={i}
                  x={miniOffsetX + (c.x - svgBBox.x) * miniScale}
                  y={miniOffsetY + (c.y - svgBBox.y) * miniScale}
                  width={Math.max(c.width * miniScale, 4)}
                  height={Math.max(c.height * miniScale, 4)}
                  fill="#eaeef2"
                  stroke="#d0d7de"
                  strokeWidth={0.75}
                  rx={2}
                />
              ))}

              {/* Every Real Node Block */}
              {nodeRects.map((n) => {
                const isSelected = n.id === selectedId;
                const isHighlighted = highlightedIds.includes(n.id) && !isSelected;
                return (
                  <rect
                    key={n.id}
                    x={miniOffsetX + (n.x - svgBBox.x) * miniScale}
                    y={miniOffsetY + (n.y - svgBBox.y) * miniScale}
                    width={Math.max(n.width * miniScale, 2.5)}
                    height={Math.max(n.height * miniScale, 2)}
                    fill={isSelected ? "#0969da" : isHighlighted ? "#bf8700" : "#ffffff"}
                    stroke={isSelected ? "#0969da" : isHighlighted ? "#bf8700" : "#d0d7de"}
                    strokeWidth={isSelected ? 1.5 : 0.75}
                    rx={1}
                  />
                );
              })}

              {/* Interactive Viewport Indicator Frame (Click & Drag to pan) */}
              <rect
                x={miniViewport.x}
                y={miniViewport.y}
                width={Math.max(miniViewport.width, 8)}
                height={Math.max(miniViewport.height, 6)}
                fill="rgba(9, 105, 218, 0.10)"
                stroke="#0969da"
                strokeWidth={1.5}
                rx={2}
                className="cursor-move"
                onMouseDown={handleMiniDragStart}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Render Error Alert */}
      {renderError && (
        <div className="absolute inset-4 z-30 flex items-center justify-center p-6">
          <div className="bg-[#fff8c5] border border-[#d0d7de] text-[#1f2328] p-4 rounded-xl max-w-md text-xs shadow-md">
            <h4 className="font-semibold mb-1 text-[#9a6700]">Failed to Render Diagram</h4>
            <p className="font-mono text-[11px] text-[#57606a]">{renderError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MermaidCanvas;
