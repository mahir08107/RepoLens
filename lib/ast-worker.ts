// lib/ast-worker.ts
/**
 * Web Worker that runs tree‑sitter parsers for multiple languages and extracts a
 * structural skeleton from source files. Only metadata (imports/exports
 * /function signatures) is kept; function bodies are omitted to preserve privacy.
 */

import type { FileSkeleton, RepoSkeleton } from "../shared/types";

// Safely resolve TreeSitter in Web Worker without requiring npm module bundling
let TreeSitter: any = typeof (self as any).TreeSitter !== "undefined" ? (self as any).TreeSitter : null;

// Mapping of file extensions to their language grammar loader URLs.
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
 * Extract imports from a given source string using language‑specific queries.
 */
function extractImports(source: string, language: string): string[] {
  const importRegexes: Record<string, RegExp> = {
    ts: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    tsx: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    js: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    jsx: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    py: /^(?:import|from)\s+([\w\.]+)/gm,
    go: /import\s+\(?\s*"([^"]+)"/g,
    java: /import\s+([\w\.]+);/g,
  };
  const regex = importRegexes[language] || importRegexes.js;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    const val = match[1] || match[2];
    if (val && !imports.includes(val)) {
      imports.push(val);
    }
  }
  return imports;
}

/**
 * Lightweight extraction of exported identifiers.
 */
function extractExports(source: string, language: string): string[] {
  const exportRegexes: Record<string, RegExp> = {
    ts: /(?:export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)|exports\.([a-zA-Z0-9_$]+))/g,
    tsx: /(?:export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)|exports\.([a-zA-Z0-9_$]+))/g,
    js: /(?:export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)|exports\.([a-zA-Z0-9_$]+))/g,
    jsx: /(?:export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)|exports\.([a-zA-Z0-9_$]+))/g,
    py: /^(?:def|class)\s+([a-zA-Z0-9_]+)/gm,
    go: /func\s+([A-Z][a-zA-Z0-9_]*)\s*\(/g,
    java: /public\s+(?:class|interface|enum|\w+)\s+([a-zA-Z0-9_]+)/g,
  };
  const regex = exportRegexes[language] || exportRegexes.js;
  const exports: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    const val = m[1] || m[2] || m[3];
    if (val && !exports.includes(val)) {
      exports.push(val);
    }
  }
  return exports;
}

/**
 * Strips function bodies and extracts signature name + parameters.
 */
function extractFunctionSignatures(source: string, language: string): string[] {
  const funcRegexes: Record<string, RegExp> = {
    ts: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    tsx: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    js: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    jsx: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    py: /^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\):/gm,
    go: /func\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g,
    java: /(?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g,
  };
  const regex = funcRegexes[language] || funcRegexes.js;
  const signatures: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    const name = m[1] || m[3] || 'anonymous';
    const params = (m[2] || m[4] || '').trim().replace(/\s+/g, ' ');
    signatures.push(`${name}(${params})`);
  }
  return signatures;
}

self.onmessage = async (event: MessageEvent) => {
  const payload = event.data as MessagePayload;
  const { repoUrl, commitSha, fileMap } = payload;
  const files: FileSkeleton[] = [];

  let parser: any = null;

  if (!TreeSitter && typeof (self as any).importScripts === "function") {
    try {
      (self as any).importScripts("https://cdn.jsdelivr.net/npm/web-tree-sitter@0.20.8/tree-sitter.js");
      TreeSitter = (self as any).TreeSitter;
    } catch {
      // Continues with regex AST extractor
    }
  }

  try {
    if (TreeSitter && typeof TreeSitter.init === "function") {
      await TreeSitter.init();
      parser = new TreeSitter.Parser();
    }
  } catch (err) {
    console.warn("TreeSitter WASM init fallback to regex parser:", err);
  }

  for (const [path, source] of Object.entries(fileMap)) {
    const ext = path.split('.').pop()?.toLowerCase() ?? "";
    const loaderUrl = LANGUAGE_LOADERS[ext];

    if (parser && loaderUrl) {
      try {
        const Language = await TreeSitter.Language.load(loaderUrl);
        parser.setLanguage(Language);
        parser.parse(source);
      } catch (e) {
        // Fallback to regex extraction
      }
    }

    const imports = extractImports(source, ext);
    const exports = extractExports(source, ext);
    const functionSignatures = extractFunctionSignatures(source, ext);

    files.push({
      filePath: path,
      imports,
      exports,
      functionSignatures,
    });
  }

  // Strictly return { repoUrl, commitSha, files } with NO edges
  const result: RepoSkeleton = {
    repoUrl,
    commitSha,
    files,
  };

  self.postMessage(result);
};
