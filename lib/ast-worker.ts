// lib/ast-worker.ts
/**
 * Web Worker that runs tree‑sitter parsers for multiple languages and extracts a
 * structural skeleton from source files. Only metadata (imports/exports/classes
 * /function signatures) is kept; function bodies are omitted to preserve privacy.
 */

import * as TreeSitter from "web-tree-sitter";

// Mapping of file extensions to their language grammar loader URLs. In a real
// project these would point to the pre‑compiled WASM binaries bundled with the
 // app. Here we use placeholder CDN URLs (Tree‑sitter grammar releases).
const LANGUAGE_LOADERS: Record<string, string> = {
  ts: "https://unpkg.com/tree-sitter-typescript@0.20.2/wasm/typescript.wasm",
  tsx: "https://unpkg.com/tree-sitter-typescript@0.20.2/wasm/tsx.wasm",
  js: "https://unpkg.com/tree-sitter-javascript@0.20.0/wasm/javascript.wasm",
  jsx: "https://unpkg.com/tree-sitter-javascript@0.20.0/wasm/jsx.wasm",
  py: "https://unpkg.com/tree-sitter-python@0.20.4/wasm/python.wasm",
  go: "https://unpkg.com/tree-sitter-go@0.20.0/wasm/go.wasm",
  java: "https://unpkg.com/tree-sitter-java@0.20.2/wasm/java.wasm",
};

interface MessagePayload {
  repoUrl: string;
  commitSha: string;
  fileMap: Record<string, string>; // path -> raw source code
}

/**
 * Extract imports from a given source string using a language‑specific query.
 */
function extractImports(source: string, language: string): string[] {
  const importRegexes: Record<string, RegExp> = {
    ts: /import\s+.*?from\s+['"]([^'\"]+)['"]/g,
    tsx: /import\s+.*?from\s+['"]([^'\"]+)['"]/g,
    js: /import\s+.*?from\s+['"]([^'\"]+)['"]/g,
    jsx: /import\s+.*?from\s+['"]([^'\"]+)['"]/g,
    py: /^(?:import|from)\s+([\w\.]+)/gm,
    go: /import\s+\(?\s*"([^"]+)"/g,
    java: /import\s+([\w\.]+);/g,
  };
  const regex = importRegexes[language];
  if (!regex) return [];
  const imports: string[] = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * Very lightweight extraction of exported identifiers and class / function names.
 * This is not a full AST walk – it keeps the worker tiny and fast.
 */
function extractExports(source: string, language: string): string[] {
  const exportRegexes: Record<string, RegExp> = {
    ts: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    tsx: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    js: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    jsx: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    py: /^(?:def|class)\s+(\w+)/gm,
    go: /func\s+(\w+)\s*\(/g,
    java: /public\s+(?:class|interface|enum|\w+)\s+(\w+)/g,
  };
  const regex = exportRegexes[language];
  if (!regex) return [];
  const exports: string[] = [];
  let m;
  while ((m = regex.exec(source)) !== null) {
    exports.push(m[1]);
  }
  return exports;
}

function extractClasses(source: string, language: string): string[] {
  const classRegexes: Record<string, RegExp> = {
    ts: /class\s+(\w+)/g,
    tsx: /class\s+(\w+)/g,
    js: /class\s+(\w+)/g,
    jsx: /class\s+(\w+)/g,
    py: /^class\s+(\w+)/gm,
    go: /type\s+(\w+)\s+struct/g,
    java: /class\s+(\w+)/g,
  };
  const regex = classRegexes[language];
  if (!regex) return [];
  const classes: string[] = [];
  let m;
  while ((m = regex.exec(source)) !== null) {
    classes.push(m[1]);
  }
  return classes;
}

function extractFunctions(source: string, language: string): string[] {
  const funcRegexes: Record<string, RegExp> = {
    ts: /function\s+(\w+)\s*\(([^)]*)\)/g,
    tsx: /function\s+(\w+)\s*\(([^)]*)\)/g,
    js: /function\s+(\w+)\s*\(([^)]*)\)/g,
    jsx: /function\s+(\w+)\s*\(([^)]*)\)/g,
    py: /^def\s+(\w+)\s*\(([^)]*)\)/gm,
    go: /func\s+(\w+)\s*\(([^)]*)\)/g,
    java: /(?:public|private|protected)\s+\w+\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
  };
  const regex = funcRegexes[language];
  if (!regex) return [];
  const funcs: string[] = [];
  let m;
  while ((m = regex.exec(source)) !== null) {
    const params = m[2].trim().split(/\s*,\s*/).filter(Boolean).join(", ");
    funcs.push(`${m[1]}(${params})`);
  }
  return funcs;
}

self.onmessage = async (event: MessageEvent) => {
  const payload = event.data as MessagePayload;
  const { repoUrl, commitSha, fileMap } = payload;
  const files: any[] = [];
  const edges: { from: string; to: string }[] = [];

  // Pre‑load all required language parsers (TreeSitter.init() once).
  await TreeSitter.init();

  const parser = new TreeSitter.Parser();

  for (const [path, source] of Object.entries(fileMap)) {
    const ext = path.split('.').pop() ?? "";
    const loaderUrl = LANGUAGE_LOADERS[ext];
    if (!loaderUrl) continue; // unsupported file type
    const Language = await TreeSitter.Language.load(loaderUrl);
    parser.setLanguage(Language);
    // Parsing is cheap; we still keep the tree for possible deeper analysis.
    parser.parse(source);
    const languageKey = ext; // use extension as language identifier
    const imports = extractImports(source, languageKey);
    const exports = extractExports(source, languageKey);
    const classes = extractClasses(source, languageKey);
    const functions = extractFunctions(source, languageKey);
    files.push({ path, imports, exports, classes, functions });
    // Create dependency edges from each imported module to this file.
    imports.forEach((imp) => {
      edges.push({ from: imp, to: path });
    });
  }

  const result = {
    repoUrl,
    commitSha,
    files,
    edges,
  } as any;
  self.postMessage(result);
};
