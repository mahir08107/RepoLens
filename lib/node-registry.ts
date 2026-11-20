// lib/node-registry.ts
/**
 * Builds a single source of truth for every block rendered on the architecture canvas.
 *
 * The canvas can be drawn from several sources (sample demo, algorithmic generator,
 * Cloud Run ArchitectureMap, or a Gemini-authored Mermaid diagram), and each uses
 * different node IDs. This registry parses the Mermaid definition and reconciles every
 * canvas node with:
 *   - the backend ArchitectureMap node (`node-0`, `node-1`, ...) when available, and
 *   - the matching FileSkeleton from the privacy-stripped RepoSkeleton.
 *
 * That lets the chat send backend-native IDs to POST /api/chat and map the returned
 * `highlightedNodeIds` back onto the exact blocks rendered on screen.
 */
import type { ArchitectureMap, FileSkeleton, MapNode, RepoSkeleton } from "@/shared/types";

export interface CanvasNode {
  /** Mermaid node ID as rendered on the canvas (e.g. `node_node_0`, `node_app_page`). */
  id: string;
  label: string;
  filePath: string;
  zone: string;
  summary: string;
  /** Backend ArchitectureMap node ID (e.g. `node-0`) when the map came from Cloud Run. */
  archId?: string;
  file?: FileSkeleton;
}

export interface CanvasEdge {
  source: string;
  target: string;
  relation?: string;
}

export interface NodeRegistry {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  byId: Map<string, CanvasNode>;
  /** Maps any backend / canvas / file-path identifier to a rendered canvas node ID. */
  resolve: (id: string) => string | null;
  /** ID to send to the backend for a canvas node (ArchitectureMap ID when known). */
  toBackendId: (canvasId: string) => string;
  /** Canvas node IDs whose file paths are mentioned in free text (AI answer fallback). */
  findMentioned: (text: string) => string[];
  incoming: (id: string) => CanvasEdge[];
  outgoing: (id: string) => CanvasEdge[];
}

const RESERVED = new Set([
  "subgraph",
  "end",
  "class",
  "classdef",
  "style",
  "linkstyle",
  "direction",
  "click",
  "flowchart",
  "graph",
]);

export const sanitizeId = (s: string): string => s.replace(/[^a-zA-Z0-9_]/g, "_");
const cleanPath = (p: string): string => p.replace(/^\.?\//, "");
const baseName = (p: string): string => cleanPath(p).split("/").pop() || p;
const stripExt = (p: string): string =>
  p.replace(/\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|rb|php|vue|svelte)$/i, "");

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|#quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes leading emoji / pictograms such as "📄 " or "🖥️ ". */
function stripIcon(s: string): string {
  return s.replace(/^[^A-Za-z0-9_.\/@(\[-]+/, "").trim();
}

function titleOf(raw: string): string {
  const bold = raw.match(/<b>([\s\S]*?)<\/b>/i);
  return stripIcon(stripHtml(bold ? bold[1] : raw));
}

function labelParts(raw: string): { label: string; summary: string; caps: string } {
  const bold = raw.match(/<b>([\s\S]*?)<\/b>/i);
  const label = stripIcon(stripHtml(bold ? bold[1] : raw.split(/<br\s*\/?>/i)[0]));
  const smalls = Array.from(raw.matchAll(/<small>([\s\S]*?)<\/small>/gi)).map((m) => stripHtml(m[1]));
  const summary = smalls.find((s) => !s.startsWith("⚡")) || "";
  const caps = (smalls.find((s) => s.startsWith("⚡")) || "").replace(/^⚡\s*/, "");
  return { label, summary, caps };
}

interface ParsedNode {
  id: string;
  rawLabel: string;
  zone: string;
}

function parseDefinition(def: string): { nodes: Map<string, ParsedNode>; edges: CanvasEdge[] } {
  const nodes = new Map<string, ParsedNode>();
  const edges: CanvasEdge[] = [];
  const zoneStack: string[] = [];

  const nodeRe = /^([A-Za-z0-9_]+)\s*[\[\(\{>]+\s*"([\s\S]*)"\s*[\]\)\}]+\s*;?$/;
  const bareRe = /^([A-Za-z0-9_]+)\s*\[([^\]"]+)\]\s*;?$/;
  const edgeRe =
    /^([A-Za-z0-9_]+)\s*(?:-->|==>|-\.->|---|===|-\.-)\s*(?:\|\s*"?([^|]*?)"?\s*\|)?\s*([A-Za-z0-9_]+)/;

  for (const line of def.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("%%")) continue;

    const sg = t.match(/^subgraph\s+([A-Za-z0-9_]+)\s*(?:\[\s*"?([\s\S]*?)"?\s*\])?\s*$/);
    if (sg) {
      zoneStack.push(titleOf(sg[2] || sg[1]));
      continue;
    }
    if (/^end\b/.test(t)) {
      zoneStack.pop();
      continue;
    }

    const firstWord = t.split(/[\s\[\(\{>]/)[0].toLowerCase();
    if (RESERVED.has(firstWord)) continue;

    const edge = t.match(edgeRe);
    if (edge) {
      edges.push({ source: edge[1], target: edge[3], relation: edge[2]?.trim() || undefined });
      continue;
    }

    const node = t.match(nodeRe) || t.match(bareRe);
    if (node && !nodes.has(node[1])) {
      nodes.set(node[1], { id: node[1], rawLabel: node[2], zone: zoneStack[0] || "" });
    }
  }

  return { nodes, edges };
}

export function buildNodeRegistry(
  definition: string,
  skeleton: RepoSkeleton | null,
  architectureMap: ArchitectureMap | null
): NodeRegistry {
  const parsed = parseDefinition(definition || "");
  const files = skeleton?.files || [];
  const archNodes: MapNode[] = architectureMap?.nodes || [];

  const fileBySafeId = new Map<string, FileSkeleton>();
  files.forEach((f) => fileBySafeId.set(`node_${sanitizeId(cleanPath(f.filePath))}`, f));
  const fileByPath = new Map<string, FileSkeleton>();
  files.forEach((f) => fileByPath.set(cleanPath(f.filePath), f));
  const archByCanvasId = new Map<string, MapNode>();
  archNodes.forEach((n) => archByCanvasId.set(`node_${sanitizeId(n.id)}`, n));
  const archByPath = new Map<string, MapNode>();
  archNodes.forEach((n) => archByPath.set(cleanPath(n.filePath), n));

  const matchByLabel = (label: string): FileSkeleton | undefined => {
    const token = label.split(/\s+/)[0];
    if (!token || !/\.[A-Za-z0-9]+$/.test(token)) return undefined;
    const candidates = files.filter((f) => baseName(f.filePath) === token);
    if (candidates.length <= 1) return candidates[0];
    const hint = (label.match(/\(([^)]+)\)/)?.[1] || "").toLowerCase();
    return (hint && candidates.find((f) => f.filePath.toLowerCase().includes(hint))) || candidates[0];
  };

  // 1. Reconcile every rendered canvas node with backend + skeleton metadata
  const nodes: CanvasNode[] = [];
  parsed.nodes.forEach((p) => {
    const { label, summary, caps } = labelParts(p.rawLabel);
    let archNode = archByCanvasId.get(p.id);
    const file = archNode
      ? fileByPath.get(cleanPath(archNode.filePath))
      : fileBySafeId.get(p.id) || matchByLabel(label);
    if (!archNode && file) archNode = archByPath.get(cleanPath(file.filePath));

    nodes.push({
      id: p.id,
      label: archNode?.label || label || p.id,
      filePath: archNode?.filePath || file?.filePath || "",
      zone: archNode?.zone || p.zone || "",
      summary: archNode?.summary || summary || (caps ? `Key capabilities: ${caps}` : ""),
      archId: archNode?.id,
      file,
    });
  });

  const byId = new Map<string, CanvasNode>();
  nodes.forEach((n) => byId.set(n.id, n));

  // 2. Edges: diagram edges + backend map edges + import-derived edges
  const edges: CanvasEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (e: CanvasEdge) => {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) return;
    const key = `${e.source}->${e.target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(e);
  };

  parsed.edges.forEach(addEdge);

  const canvasByArchId = new Map<string, string>();
  nodes.forEach((n) => n.archId && canvasByArchId.set(n.archId, n.id));
  (architectureMap?.edges || []).forEach((e) => {
    const s = canvasByArchId.get(e.source);
    const t = canvasByArchId.get(e.target);
    if (s && t) addEdge({ source: s, target: t, relation: e.relation });
  });

  const canvasByModulePath = new Map<string, string>();
  nodes.forEach((n) => {
    if (!n.filePath) return;
    const key = stripExt(cleanPath(n.filePath));
    canvasByModulePath.set(key, n.id);
    if (key.endsWith("/index")) canvasByModulePath.set(key.slice(0, -"/index".length), n.id);
  });

  const resolveImport = (spec: string, fromPath: string): string | null => {
    const quoted = spec.match(/['"]([^'"]+)['"]/);
    let target = (quoted ? quoted[1] : spec).trim();
    if (target.startsWith("@/")) {
      target = target.slice(2);
    } else if (target.startsWith("./") || target.startsWith("../")) {
      const parts = cleanPath(fromPath).split("/");
      parts.pop();
      for (const seg of target.split("/")) {
        if (seg === "." || seg === "") continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
      }
      target = parts.join("/");
    } else {
      return null;
    }
    return canvasByModulePath.get(stripExt(target)) || null;
  };

  nodes.forEach((n) => {
    if (!n.file || !n.filePath) return;
    (n.file.imports || []).forEach((spec) => {
      const target = resolveImport(spec, n.filePath);
      if (target) addEdge({ source: n.id, target, relation: "imports" });
    });
  });

  // 3. Lookup helpers
  const resolve = (id: string): string | null => {
    if (!id) return null;
    if (byId.has(id)) return id;
    const viaArch = canvasByArchId.get(id);
    if (viaArch) return viaArch;
    const sanitized = `node_${sanitizeId(id)}`;
    if (byId.has(sanitized)) return sanitized;
    const path = cleanPath(id);
    const viaPath = nodes.find((n) => n.filePath && cleanPath(n.filePath) === path);
    return viaPath ? viaPath.id : null;
  };

  const toBackendId = (canvasId: string): string => byId.get(canvasId)?.archId || canvasId;

  const findMentioned = (text: string): string[] => {
    if (!text) return [];
    const withFiles = nodes.filter((n) => n.filePath);
    const byFullPath = withFiles.filter((n) => text.includes(cleanPath(n.filePath))).map((n) => n.id);
    if (byFullPath.length > 0) return byFullPath;

    const baseCounts = new Map<string, number>();
    withFiles.forEach((n) => baseCounts.set(baseName(n.filePath), (baseCounts.get(baseName(n.filePath)) || 0) + 1));
    return withFiles
      .filter((n) => {
        const b = baseName(n.filePath);
        return baseCounts.get(b) === 1 && text.includes(b);
      })
      .map((n) => n.id);
  };

  return {
    nodes,
    edges,
    byId,
    resolve,
    toBackendId,
    findMentioned,
    incoming: (id) => edges.filter((e) => e.target === id),
    outgoing: (id) => edges.filter((e) => e.source === id),
  };
}

