// lib/diagram-generator.ts
import type { RepoSkeleton, FileSkeleton, ArchitectureMap, MapNode, MapEdge, ZoneCategory } from "@/shared/types";

export interface FolderGroup {
  id: string;
  folderPath: string;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  order: number;
  files: FileSkeleton[];
}

/**
 * Infer architectural layer for a file when the repository is flat or has a single folder.
 */
function inferArchitecturalZone(filePath: string, exports: string[] = [], signatures: string[] = []): {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  order: number;
} {
  const p = filePath.toLowerCase();
  const allSymbols = [...exports, ...signatures].join(" ").toLowerCase();

  // Authentication & Session
  if (
    p.includes("auth") ||
    p.includes("login") ||
    p.includes("session") ||
    p.includes("jwt") ||
    p.includes("user") && !p.includes("dashboard") ||
    allSymbols.includes("watchauth") ||
    allSymbols.includes("currentuser") ||
    allSymbols.includes("signin")
  ) {
    if (p.includes("login") || p.includes("view") || p.endsWith(".html")) {
      return {
        id: "zone_ui",
        name: "🖥️ Presentation & User Interface",
        description: "Login views, forms & interaction templates",
        icon: "🖥️",
        color: "#8B5CF6",
        bg: "#F5F3FF",
        border: "#8B5CF6",
        text: "#4C1D95",
        order: 1,
      };
    }
    return {
      id: "zone_auth",
      name: "🔐 Authentication & Identity",
      description: "User sessions, credentials & access control",
      icon: "🔐",
      color: "#EC4899",
      bg: "#FDF2F8",
      border: "#EC4899",
      text: "#831843",
      order: 2,
    };
  }

  // User Interface & Views
  if (
    p.includes("dashboard") ||
    p.includes("page") ||
    p.includes("view") ||
    p.includes("ui") ||
    p.includes("component") ||
    p.endsWith(".html") ||
    p.endsWith(".jsx") ||
    p.endsWith(".tsx") ||
    allSymbols.includes("render") ||
    allSymbols.includes("dom")
  ) {
    return {
      id: "zone_ui",
      name: "🖥️ Presentation & Dashboard Views",
      description: "User dashboard, widgets & UI event handlers",
      icon: "🖥️",
      color: "#8B5CF6",
      bg: "#F5F3FF",
      border: "#8B5CF6",
      text: "#4C1D95",
      order: 1,
    };
  }

  // Configuration & Cloud Services
  if (
    p.includes("config") ||
    p.includes("firebase") ||
    p.includes("database") ||
    p.includes("db") ||
    p.includes("env") ||
    p.includes("store") ||
    allSymbols.includes("firebaseconfig") ||
    allSymbols.includes("initapp")
  ) {
    return {
      id: "zone_config",
      name: "⚙️ Configuration & Backend Services",
      description: "Cloud SDK setup, credentials & storage configs",
      icon: "⚙️",
      color: "#10B981",
      bg: "#ECFDF5",
      border: "#10B981",
      text: "#064E3B",
      order: 3,
    };
  }

  // Core Logic & Utilities
  return {
    id: "zone_logic",
    name: "⚡ Core Logic & Data Engine",
    description: "Business logic, algorithms & data utilities",
    icon: "⚡",
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#F59E0B",
    text: "#78350F",
    order: 4,
  };
}

/**
 * Categorize a file path into a clean directory group for multi-folder repositories.
 */
function getFolderCategory(filePath: string): {
  id: string;
  folderPath: string;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  order: number;
} {
  const clean = filePath.replace(/^\.?\//, "");
  const segments = clean.split("/");
  const first = segments[0]?.toLowerCase() || "";
  const second = segments[1]?.toLowerCase() || "";

  if (first === "app") {
    if (second === "api") {
      return {
        id: "folder_app_api",
        folderPath: "app/api/",
        title: "📁 app/api/ • Serverless Route Handlers",
        description: "Next.js backend endpoints & diagram streaming",
        color: "#3B82F6",
        bg: "#EFF6FF",
        border: "#3B82F6",
        text: "#1E3A8A",
        order: 2,
      };
    }
    return {
      id: "folder_app",
      folderPath: "app/",
      title: "📁 app/ • Application Shell & Pages",
      description: "Root workspace view, layout & TopBar controls",
      color: "#8B5CF6",
      bg: "#F5F3FF",
      border: "#8B5CF6",
      text: "#4C1D95",
      order: 1,
    };
  }

  if (first === "components" || first === "ui" || first === "views") {
    return {
      id: "folder_components",
      folderPath: `${first}/`,
      title: `📁 ${first}/ • Visual Canvas & Copilot Panels`,
      description: "Mermaid architecture canvas, chat sidebar & inspectors",
      color: "#6366F1",
      bg: "#EEF2FF",
      border: "#6366F1",
      text: "#312E81",
      order: 3,
    };
  }

  if (first === "lib" || first === "core" || first === "services" || first === "parser") {
    return {
      id: "folder_lib",
      folderPath: `${first}/`,
      title: `📁 ${first}/ • AST Engine & Privacy Stripper`,
      description: "Tree-sitter WASM parser, worker & diagram generators",
      color: "#F59E0B",
      bg: "#FFFBEB",
      border: "#F59E0B",
      text: "#78350F",
      order: 4,
    };
  }

  if (first === "frontend" || first === "client") {
    return {
      id: "folder_frontend",
      folderPath: `${first}/`,
      title: `📁 ${first}/ • Frontend Client & API Services`,
      description: "Client API adapter, WASM loader & mock datasets",
      color: "#0EA5E9",
      bg: "#F0F9FF",
      border: "#0EA5E9",
      text: "#0C4A6E",
      order: 5,
    };
  }

  if (first === "backend" || first === "server" || first === "api") {
    return {
      id: "folder_backend",
      folderPath: `${first}/`,
      title: `📁 ${first}/ • Cloud Run Server & AI Engine`,
      description: "Express API, Gemma 4B classifier & Gemini architect",
      color: "#10B981",
      bg: "#ECFDF5",
      border: "#10B981",
      text: "#064E3B",
      order: 6,
    };
  }

  if (first === "db" || first === "database" || first === "models") {
    return {
      id: "folder_db",
      folderPath: `${first}/`,
      title: `📁 ${first}/ • Database & Storage Cache`,
      description: "Firestore caching, schemas & state persistence",
      color: "#14B8A6",
      bg: "#F0FDFA",
      border: "#14B8A6",
      text: "#134E4A",
      order: 7,
    };
  }

  if (first === "shared" || first === "types" || first === "contracts") {
    return {
      id: "folder_shared",
      folderPath: `${first}/`,
      title: `📁 ${first}/ • Type Contracts & Interfaces`,
      description: "RepoSkeleton, ArchitectureMap & Chat schemas",
      color: "#64748B",
      bg: "#F8FAFC",
      border: "#64748B",
      text: "#0F172A",
      order: 8,
    };
  }

  if (segments.length === 1) {
    return {
      id: "folder_root",
      folderPath: "root/",
      title: "📁 root • Project Config & Manifests",
      description: "Package configs, tsconfig & workspace settings",
      color: "#94A3B8",
      bg: "#F1F5F9",
      border: "#94A3B8",
      text: "#334155",
      order: 9,
    };
  }

  const safeId = `folder_${first.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  return {
    id: safeId,
    folderPath: `${first}/`,
    title: `📁 ${first}/ • ${first.toUpperCase()} Subsystem`,
    description: `Module implementation files in ${first}/`,
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#6B7280",
    text: "#1F2937",
    order: 10,
  };
}

/**
 * Strips parentheses, parameters, return types, export/async keywords,
 * and quotes from function signature strings to isolate just the safe function name.
 */
function cleanFunc(s: string): string {
  if (!s) return "";
  return s
    .split("(")[0]
    .replace(/^async\s+/, "")
    .replace(/^(export\s+)?(function\s+|const\s+|class\s+|let\s+|var\s+)/, "")
    .replace(/[^a-zA-Z0-9_$]/g, "")
    .trim();
}

/**
 * Sanitizes arbitrary text so it can safely be embedded in Mermaid node labels
 * and subgraph titles without breaking Mermaid's flowchart parser.
 */
export function sanitizeMermaidText(str: string): string {
  if (!str) return "";
  return str
    .replace(/"/g, "'")
    .replace(/`/g, "'")
    .replace(/[\r\n]+/g, " ")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .trim();
}

/**
 * Infer human-friendly role purpose and capabilities for a file.
 */
function inferFileDetails(file: FileSkeleton): {
  icon: string;
  purpose: string;
  capabilities: string;
} {
  const filePath = file.filePath.toLowerCase();
  const baseName = file.filePath.split("/").pop() || file.filePath;
  const nameLower = baseName.toLowerCase();

  // Known RepoLens core files
  if (nameLower === "page.tsx") {
    return { icon: "📄", purpose: "Main visual workspace, TopBar & controls", capabilities: "Home(), handleGenerate()" };
  }
  if (nameLower === "layout.tsx") {
    return { icon: "📄", purpose: "Root HTML layout, typography & metadata", capabilities: "RootLayout(), metadata" };
  }
  if (nameLower.includes("canvas")) {
    return { icon: "🎨", purpose: "Interactive pan, zoom & diagram renderer", capabilities: "MermaidCanvas(), applyHighlights()" };
  }
  if (nameLower.includes("chat")) {
    return { icon: "💬", purpose: "AI copilot chat panel & code jumping", capabilities: "ChatSidebar(), handleSend()" };
  }
  if (nameLower.includes("parser")) {
    return { icon: "⚡", purpose: "Client AST extraction & body stripper", capabilities: "parseRepo(), parseFiles()" };
  }
  if (nameLower.includes("diagram") || nameLower.includes("generator")) {
    return { icon: "🗺️", purpose: "Folder-centric architecture & pipeline builder", capabilities: "generateMermaidDiagram()" };
  }

  // IoT / Sensor / Circuit / Vanilla JS apps (e.g. shristi-circuittech)
  if (nameLower.includes("dashboard")) {
    const hasThingSpeak = file.functionSignatures?.some((s) => s.toLowerCase().includes("thingspeak"));
    const funcs = (file.functionSignatures || []).map(cleanFunc).filter(Boolean);
    return {
      icon: "📊",
      purpose: hasThingSpeak ? "Real-time circuit telemetry & IoT monitoring" : "User dashboard & activity view",
      capabilities: funcs.length ? funcs.slice(0, 2).map((f) => `${f}()`).join(", ") : "renderDashboard()",
    };
  }
  if (nameLower.includes("auth")) {
    const exps = (file.exports || []).map(cleanFunc).filter(Boolean);
    return {
      icon: "🔐",
      purpose: "Firebase authentication & user state observer",
      capabilities: exps.length ? exps.slice(0, 2).join(", ") : "watchAuth, getCurrentUser",
    };
  }
  if (nameLower.includes("login")) {
    const funcs = (file.functionSignatures || []).map(cleanFunc).filter(Boolean);
    return {
      icon: "🔑",
      purpose: "User authentication form & login controller",
      capabilities: funcs.length ? funcs.slice(0, 2).map((f) => `${f}()`).join(", ") : "handleLogin()",
    };
  }
  if (nameLower.includes("firebase")) {
    const exps = (file.exports || []).map(cleanFunc).filter(Boolean);
    return {
      icon: "🔥",
      purpose: "Firebase SDK initialization & credentials config",
      capabilities: exps.length ? exps.slice(0, 2).join(", ") : "firebaseConfig",
    };
  }

  // Generic heuristic detection
  const keyExports = (file.exports || []).map(cleanFunc).filter(Boolean).slice(0, 2);
  const keyFuncs = (file.functionSignatures || []).map(cleanFunc).filter(Boolean).slice(0, 2);

  const capabilities =
    keyExports.length > 0
      ? `Exports: ${keyExports.join(", ")}`
      : keyFuncs.length > 0
      ? `Func: ${keyFuncs.map((f) => `${f}()`).join(", ")}`
      : "Module exports";

  let icon = "📄";
  let purpose = "Module implementation";

  if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx") || filePath.endsWith(".html")) {
    icon = "⚛️";
    purpose = "UI component & render view";
  } else if (filePath.includes("route") || filePath.includes("api")) {
    icon = "🌐";
    purpose = "API endpoint & request handler";
  } else if (filePath.includes("service") || filePath.includes("logic")) {
    icon = "⚙️";
    purpose = "Business logic & domain service";
  } else if (filePath.includes("db") || filePath.includes("model")) {
    icon = "💾";
    purpose = "Database schema & persistence";
  } else if (filePath.includes("config") || filePath.includes("env")) {
    icon = "🔧";
    purpose = "Application environment configuration";
  }

  return { icon, purpose, capabilities };
}

/**
 * Generate a complete, rich graphical Mermaid architecture representation with NODES and EDGES.
 * Handles both multi-folder architectures and flat single-directory projects cleanly.
 */
export function generateMermaidDiagram(skeleton: RepoSkeleton): {
  mermaidDefinition: string;
  groupColors: Record<string, string>;
  entryNodeId?: string;
} {
  const files = skeleton.files || [];
  if (files.length === 0) {
    return {
      mermaidDefinition: `flowchart TD\n  empty["<b>${skeleton.repoUrl || 'Repository'}</b><br/><small>No source files found</small>"]\n  classDef def fill:#F8FAFC,stroke:#64748B,color:#0F172A;\n  class empty def;`,
      groupColors: { Repository: "#64748B" },
    };
  }

  // Inspect folder distribution
  const distinctFolders = new Set(
    files.map((f) => {
      const clean = f.filePath.replace(/^\.?\//, "");
      const segs = clean.split("/");
      return segs.length > 1 ? segs[0].toLowerCase() : "root";
    })
  );

  const isFlatProject = distinctFolders.size <= 1;

  // Render accordingly: Zone-based (flat) vs Folder-based (multi-folder)
  if (isFlatProject) {
    return generateZoneBasedDiagram(skeleton);
  } else {
    return generateFolderBasedDiagram(skeleton);
  }
}

/**
 * Generate a graph with architectural zones and functional dependency edges for flat repositories.
 */
function generateZoneBasedDiagram(skeleton: RepoSkeleton): {
  mermaidDefinition: string;
  groupColors: Record<string, string>;
  entryNodeId?: string;
} {
  const files = skeleton.files || [];
  const lines: string[] = ["flowchart LR"];
  const classDefs: string[] = [];
  const groupColors: Record<string, string> = {};

  // 1. Group files by architectural zone
  interface ZoneBucket {
    id: string;
    name: string;
    description: string;
    color: string;
    bg: string;
    border: string;
    text: string;
    order: number;
    files: FileSkeleton[];
  }

  const zoneMap = new Map<string, ZoneBucket>();

  for (const file of files) {
    const zone = inferArchitecturalZone(file.filePath, file.exports, file.functionSignatures);
    if (!zoneMap.has(zone.id)) {
      zoneMap.set(zone.id, {
        id: zone.id,
        name: zone.name,
        description: zone.description,
        color: zone.color,
        bg: zone.bg,
        border: zone.border,
        text: zone.text,
        order: zone.order,
        files: [],
      });
    }
    zoneMap.get(zone.id)!.files.push(file);
  }

  const sortedZones = Array.from(zoneMap.values()).sort((a, b) => a.order - b.order);
  const fileToNodeId = new Map<string, string>();
  let firstNodeId = "";

  // 2. Render subgraphs and nodes
  sortedZones.forEach((zone) => {
    groupColors[zone.name] = zone.color;
    const classId = `cls_${zone.id}`;
    classDefs.push(
      `classDef ${classId} fill:${zone.bg},stroke:${zone.border},stroke-width:2px,color:${zone.text};`
    );

    lines.push(`  subgraph ${zone.id} ["<b>${sanitizeMermaidText(zone.name)}</b><br/><small><i>${sanitizeMermaidText(zone.description)}</i></small>"]`);
    lines.push(`    direction TB`);

    const nodeIds: string[] = [];
    zone.files.forEach((file) => {
      const cleanPath = file.filePath.replace(/^\.?\//, "");
      const safeId = `node_${cleanPath.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      fileToNodeId.set(file.filePath, safeId);
      if (!firstNodeId) firstNodeId = safeId;
      nodeIds.push(safeId);

      const baseName = cleanPath.split("/").pop() || cleanPath;
      const { icon, purpose, capabilities } = inferFileDetails(file);

      lines.push(
        `    ${safeId}["<b>${icon} ${sanitizeMermaidText(baseName)}</b><br/><small>${sanitizeMermaidText(purpose)}</small><br/><small>⚡ <code>${sanitizeMermaidText(capabilities)}</code></small>"]`
      );
    });

    lines.push("  end\n");
    lines.push(`  class ${nodeIds.join(",")} ${classId};`);
  });

  // Check if any files reference external cloud APIs like ThingSpeak or Firebase Cloud
  const hasThingSpeak = files.some(
    (f) =>
      f.filePath.toLowerCase().includes("thingspeak") ||
      f.functionSignatures?.some((s) => s.toLowerCase().includes("thingspeak"))
  );
  const hasFirebase = files.some(
    (f) =>
      f.filePath.toLowerCase().includes("firebase") ||
      f.exports?.some((e) => e.toLowerCase().includes("firebase"))
  );

  if (hasThingSpeak || hasFirebase) {
    lines.push(`  subgraph zone_external ["<b>☁️ External Cloud Services</b><br/><small><i>Third-party APIs & Identity Backends</i></small>"]`);
    lines.push(`    direction TB`);
    if (hasFirebase) {
      lines.push(`    ext_firebase["<b>🔥 Firebase Cloud</b><br/><small>Authentication & Firestore DB</small>"]`);
    }
    if (hasThingSpeak) {
      lines.push(`    ext_thingspeak["<b>📡 ThingSpeak IoT API</b><br/><small>Live sensor & circuit telemetry data</small>"]`);
    }
    lines.push(`  end\n`);
    classDefs.push(`classDef cls_external fill:#F8FAFC,stroke:#64748B,stroke-width:2px,color:#0F172A;`);
    const extNodes = [hasFirebase ? "ext_firebase" : "", hasThingSpeak ? "ext_thingspeak" : ""].filter(Boolean);
    lines.push(`  class ${extNodes.join(",")} cls_external;`);
  }

  // 3. GENERATE DEPENDENCY EDGES
  const edgesAdded = new Set<string>();
  const addEdge = (src: string, tgt: string, label: string) => {
    const key = `${src}->${tgt}`;
    if (!edgesAdded.has(key) && src !== tgt) {
      edgesAdded.add(key);
      lines.push(`  ${src} ==>|"${sanitizeMermaidText(label)}"| ${tgt}`);
    }
  };

  // Check direct imports or exported symbol matches
  files.forEach((file) => {
    const srcId = fileToNodeId.get(file.filePath);
    if (!srcId) return;

    // Direct imports
    (file.imports || []).forEach((imp) => {
      const impClean = imp.toLowerCase();
      files.forEach((targetFile) => {
        if (targetFile.filePath === file.filePath) return;
        const targetBase = targetFile.filePath.split("/").pop()?.toLowerCase().replace(/\.[^/.]+$/, "");
        if (targetBase && (impClean.includes(targetBase) || targetBase.includes(impClean))) {
          const tgtId = fileToNodeId.get(targetFile.filePath);
          if (tgtId) addEdge(srcId, tgtId, `imports ${targetBase}`);
        }
      });
    });

    // Cross-file symbol calls
    const codeKeywords = [file.filePath, ...(file.functionSignatures || [])].join(" ").toLowerCase();
    files.forEach((targetFile) => {
      if (targetFile.filePath === file.filePath) return;
      (targetFile.exports || []).forEach((exp) => {
        if (exp && codeKeywords.includes(exp.toLowerCase())) {
          const tgtId = fileToNodeId.get(targetFile.filePath);
          if (tgtId) addEdge(srcId, tgtId, `uses ${exp}`);
        }
      });
    });
  });

  // Architectural fallback connections if direct imports are omitted (common in vanilla web scripts)
  const uiFiles = files.filter((f) => inferArchitecturalZone(f.filePath, f.exports, f.functionSignatures).id === "zone_ui");
  const authFiles = files.filter((f) => inferArchitecturalZone(f.filePath, f.exports, f.functionSignatures).id === "zone_auth");
  const configFiles = files.filter((f) => inferArchitecturalZone(f.filePath, f.exports, f.functionSignatures).id === "zone_config");

  // Connect UI -> Auth
  uiFiles.forEach((u) => {
    const uId = fileToNodeId.get(u.filePath);
    authFiles.forEach((a) => {
      const aId = fileToNodeId.get(a.filePath);
      if (uId && aId) addEdge(uId, aId, u.filePath.includes("login") ? "authenticates" : "verifies session");
    });
  });

  // Connect Auth -> Config
  authFiles.forEach((a) => {
    const aId = fileToNodeId.get(a.filePath);
    configFiles.forEach((c) => {
      const cId = fileToNodeId.get(c.filePath);
      if (aId && cId) addEdge(aId, cId, "initializes SDK");
    });
  });

  // Connect to External Cloud Nodes
  if (hasThingSpeak) {
    uiFiles.forEach((u) => {
      if (u.filePath.toLowerCase().includes("dashboard") || u.functionSignatures?.some((s) => s.toLowerCase().includes("thingspeak"))) {
        const uId = fileToNodeId.get(u.filePath);
        if (uId) addEdge(uId, "ext_thingspeak", "fetches telemetry");
      }
    });
  }

  if (hasFirebase) {
    configFiles.forEach((c) => {
      const cId = fileToNodeId.get(c.filePath);
      if (cId) addEdge(cId, "ext_firebase", "authenticates & persists");
    });
  }

  // Ensure every node is connected
  if (edgesAdded.size === 0 && files.length > 1) {
    for (let i = 0; i < files.length - 1; i++) {
      const sId = fileToNodeId.get(files[i].filePath);
      const tId = fileToNodeId.get(files[i + 1].filePath);
      if (sId && tId) addEdge(sId, tId, "depends on");
    }
  }

  lines.push("");
  lines.push(...classDefs);

  return {
    mermaidDefinition: lines.join("\n"),
    groupColors,
    entryNodeId: firstNodeId,
  };
}

/**
 * Generate a folder-based graph with explicit intra-folder and inter-folder edges for multi-folder repositories.
 */
function generateFolderBasedDiagram(skeleton: RepoSkeleton): {
  mermaidDefinition: string;
  groupColors: Record<string, string>;
  entryNodeId?: string;
} {
  const files = skeleton.files || [];
  const folderMap = new Map<string, FolderGroup>();

  for (const file of files) {
    const cat = getFolderCategory(file.filePath);
    if (!folderMap.has(cat.id)) {
      folderMap.set(cat.id, {
        id: cat.id,
        folderPath: cat.folderPath,
        title: cat.title,
        description: cat.description,
        color: cat.color,
        bg: cat.bg,
        border: cat.border,
        text: cat.text,
        order: cat.order,
        files: [],
      });
    }
    folderMap.get(cat.id)!.files.push(file);
  }

  const sortedFolders = Array.from(folderMap.values()).sort((a, b) => a.order - b.order);
  const lines: string[] = ["flowchart LR"];
  const classDefs: string[] = [];
  const groupColors: Record<string, string> = {};
  const fileToNodeId = new Map<string, string>();
  let firstNodeId = "";

  sortedFolders.forEach((folder) => {
    groupColors[folder.folderPath] = folder.color;
    const classId = `cls_${folder.id}`;
    classDefs.push(
      `classDef ${classId} fill:${folder.bg},stroke:${folder.border},stroke-width:2px,color:${folder.text};`
    );

    lines.push(`  subgraph ${folder.id} ["<b>${sanitizeMermaidText(folder.title)}</b><br/><small><i>${sanitizeMermaidText(folder.description)}</i></small>"]`);
    lines.push(`    direction TB`);

    const nodeIds: string[] = [];
    const maxFiles = 5;
    const primaryFiles = folder.files.slice(0, maxFiles);
    const remainingFiles = folder.files.slice(maxFiles);

    primaryFiles.forEach((file) => {
      const cleanPath = file.filePath.replace(/^\.?\//, "");
      const safeId = `node_${cleanPath.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      fileToNodeId.set(file.filePath, safeId);
      if (!firstNodeId) firstNodeId = safeId;
      nodeIds.push(safeId);

      const baseName = cleanPath.split("/").pop() || cleanPath;
      const { icon, purpose, capabilities } = inferFileDetails(file);

      lines.push(
        `    ${safeId}["<b>${icon} ${sanitizeMermaidText(baseName)}</b><br/><small>${sanitizeMermaidText(purpose)}</small><br/><small>⚡ <code>${sanitizeMermaidText(capabilities)}</code></small>"]`
      );
    });

    if (remainingFiles.length > 0) {
      const moreId = `${folder.id}_more`;
      nodeIds.push(moreId);
      const sampleNames = remainingFiles.slice(0, 2).map((f) => sanitizeMermaidText(f.filePath.split("/").pop() || "")).join(", ");
      lines.push(
        `    ${moreId}["<small>📦 +${remainingFiles.length} more files (${sampleNames}...)</small>"]`
      );
    }

    lines.push("  end\n");
    lines.push(`  class ${nodeIds.join(",")} ${classId};`);
  });

  // Clean conduit edges between folders
  const folderIds = sortedFolders.map((f) => f.id);
  const hasFolder = (id: string) => folderIds.includes(id);

  if (hasFolder("folder_app") && hasFolder("folder_components")) {
    lines.push(`  folder_app ==>|"renders & interacts"| folder_components`);
  }
  if (hasFolder("folder_app") && hasFolder("folder_app_api")) {
    lines.push(`  folder_app ==>|"invokes API"| folder_app_api`);
  }
  if (hasFolder("folder_app") && hasFolder("folder_lib")) {
    lines.push(`  folder_app ==>|"client AST parsing"| folder_lib`);
  } else if (hasFolder("folder_app_api") && hasFolder("folder_lib")) {
    lines.push(`  folder_app_api ==>|"diagram generation"| folder_lib`);
  }
  if (hasFolder("folder_frontend") && hasFolder("folder_backend")) {
    lines.push(`  folder_frontend ==>|"HTTP REST API"| folder_backend`);
  } else if (hasFolder("folder_app_api") && hasFolder("folder_backend")) {
    lines.push(`  folder_app_api ==>|"Cloud Run requests"| folder_backend`);
  } else if (hasFolder("folder_app") && hasFolder("folder_backend")) {
    lines.push(`  folder_app ==>|"Cloud Run API"| folder_backend`);
  }
  if (hasFolder("folder_backend") && hasFolder("folder_db")) {
    lines.push(`  folder_backend ==>|"persists state"| folder_db`);
  }
  if (hasFolder("folder_shared")) {
    if (hasFolder("folder_backend")) {
      lines.push(`  folder_backend -.->|"type contracts"| folder_shared`);
    }
    if (hasFolder("folder_lib")) {
      lines.push(`  folder_lib -.->|"type contracts"| folder_shared`);
    } else if (hasFolder("folder_app")) {
      lines.push(`  folder_app -.->|"type contracts"| folder_shared`);
    }
  }

  // Sequential fallback for generic repositories without explicit names
  if (sortedFolders.length > 1 && !lines.some((l) => l.includes("==>"))) {
    for (let i = 0; i < sortedFolders.length - 1; i++) {
      const cur = sortedFolders[i].id;
      const nxt = sortedFolders[i + 1].id;
      lines.push(`  ${cur} ==>|"connects"| ${nxt}`);
    }
  }

  lines.push("");
  lines.push(...classDefs);

  return {
    mermaidDefinition: lines.join("\n"),
    groupColors,
    entryNodeId: firstNodeId,
  };
}

/**
 * Converts a backend ArchitectureMap ({ nodes, edges }) directly into a styled Mermaid flowchart.
 */
export function convertArchitectureMapToMermaid(
  architectureMap: ArchitectureMap,
  skeleton?: RepoSkeleton
): {
  mermaidDefinition: string;
  groupColors: Record<string, string>;
  entryNodeId?: string;
} {
  const nodes = architectureMap.nodes || [];
  const edges = architectureMap.edges || [];

  if (nodes.length === 0) {
    return generateMermaidDiagram(skeleton || { repoUrl: architectureMap.repoUrl, commitSha: architectureMap.commitSha, files: [] });
  }

  const zoneMeta: Record<ZoneCategory, { title: string; color: string; bg: string; border: string; text: string; order: number }> = {
    Interface: { title: "🖥️ Interface & Client Views", color: "#8B5CF6", bg: "#F5F3FF", border: "#8B5CF6", text: "#4C1D95", order: 1 },
    Auth: { title: "🔐 Authentication & Identity", color: "#EC4899", bg: "#FDF2F8", border: "#EC4899", text: "#831843", order: 2 },
    Services: { title: "⚡ Core Services & Logic", color: "#F59E0B", bg: "#FFFBEB", border: "#F59E0B", text: "#78350F", order: 3 },
    Database: { title: "💾 Data & Configuration", color: "#10B981", bg: "#ECFDF5", border: "#10B981", text: "#064E3B", order: 4 },
    Payments: { title: "💳 Billing & Payments", color: "#3B82F6", bg: "#EFF6FF", border: "#3B82F6", text: "#1E3A8A", order: 5 },
  };

  const zoneNodes = new Map<ZoneCategory, MapNode[]>();
  nodes.forEach((n) => {
    const z = n.zone || "Services";
    if (!zoneNodes.has(z)) zoneNodes.set(z, []);
    zoneNodes.get(z)!.push(n);
  });

  const lines: string[] = ["flowchart LR"];
  const classDefs: string[] = [];
  const groupColors: Record<string, string> = {};
  let firstNodeId = "";

  const sortedZones = Array.from(zoneNodes.keys()).sort((a, b) => (zoneMeta[a]?.order || 9) - (zoneMeta[b]?.order || 9));

  sortedZones.forEach((zone) => {
    const meta = zoneMeta[zone] || zoneMeta.Services;
    groupColors[zone] = meta.color;
    const classId = `cls_zone_${zone.toLowerCase()}`;
    classDefs.push(`classDef ${classId} fill:${meta.bg},stroke:${meta.border},stroke-width:2px,color:${meta.text};`);

    lines.push(`  subgraph sub_${zone.toLowerCase()} ["<b>${meta.title}</b>"]`);
    lines.push(`    direction TB`);

    const nodeIds: string[] = [];
    zoneNodes.get(zone)!.forEach((node) => {
      const safeId = `node_${node.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      if (!firstNodeId) firstNodeId = safeId;
      nodeIds.push(safeId);

      const baseName = node.filePath.split("/").pop() || node.filePath;
      lines.push(
        `    ${safeId}["<b>📄 ${sanitizeMermaidText(baseName)}</b><br/><small>${sanitizeMermaidText(node.summary || node.label)}</small>"]`
      );
    });

    lines.push("  end\n");
    lines.push(`  class ${nodeIds.join(",")} ${classId};`);
  });

  // Render edges
  edges.forEach((edge) => {
    const srcId = `node_${edge.source.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const tgtId = `node_${edge.target.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const relation = edge.relation || "depends on";
    lines.push(`  ${srcId} ==>|"${sanitizeMermaidText(relation)}"| ${tgtId}`);
  });

  lines.push("");
  lines.push(...classDefs);

  return {
    mermaidDefinition: lines.join("\n"),
    groupColors,
    entryNodeId: firstNodeId,
  };
}
