// frontend/src/parser/skeletonExtractor.ts
/**
 * Extracts a privacy‑first RepoSkeleton from raw source files.
 * It uses Tree‑sitter parsers (when available) to collect imports, exports,
 * and function signatures, stripping all function bodies.
 * For unsupported languages it falls back to simple RegExp based extraction.
 */
// Dynamically access TreeSitter if available in window/global
const getTreeSitter = () => (typeof window !== "undefined" ? (window as any).TreeSitter : null);
import type { RepoSkeleton, FileSkeleton } from "@/shared/types";

/** Regex fallbacks for quick extraction when Tree‑sitter is unavailable */
const FALLBACK_REGEX: Record<string, Record<string, RegExp>> = {
  imports: {
    ts: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    js: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    tsx: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    jsx: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
    py: /^(?:from|import)\s+([a-zA-Z0-9_.]+)/gm,
    go: /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g,
    java: /import\s+(?:static\s+)?([a-zA-Z0-9_.*]+);/g,
    cs: /using\s+([a-zA-Z0-9_.]+);/g,
    cpp: /#include\s+[<"]([^>"]+)[>"]/g,
    c: /#include\s+[<"]([^>"]+)[>"]/g,
  },
  exports: {
    ts: /export\s+(?:const|let|var|function|class|type|interface)\s+([a-zA-Z0-9_$]+)/g,
    js: /export\s+(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)/g,
    tsx: /export\s+(?:const|let|var|function|class|type|interface)\s+([a-zA-Z0-9_$]+)/g,
    jsx: /export\s+(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)/g,
    py: /^(?:def|class)\s+([a-zA-Z0-9_]+)/gm,
    go: /func\s+([a-zA-Z0-9_]+)\s*\(/g,
    java: /(?:public|protected)\s+(?:class|interface|enum)\s+([a-zA-Z0-9_]+)/g,
    cs: /(?:public|internal)\s+(?:class|interface|struct)\s+([a-zA-Z0-9_]+)/g,
    cpp: /class\s+([a-zA-Z0-9_]+)/g,
    c: /typedef\s+struct\s+([a-zA-Z0-9_]+)/g,
  },
  functions: {
    ts: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    js: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    tsx: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    jsx: /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    py: /^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gm,
    go: /func\s+(?:\([^)]+\)\s*)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g,
    java: /(?:public|private|protected)\s+(?:static\s+)?[\w<>[\],\s]+\s+(\w+)\s*\(([^)]*)\)/g,
    cs: /(?:public|private|protected|internal)\s+(?:static\s+)?[\w<>[\],\s]+\s+(\w+)\s*\(([^)]*)\)/g,
    cpp: /[\w:*&<>]+\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g,
    c: /[\w:*&]+\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g,
  },
};

/** Helper to run a regex globally and capture group 1 */
function runRegex(regex: RegExp | undefined, source: string): string[] {
  if (!regex) return [];
  const results: string[] = [];
  try {
    const rx = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = rx.exec(source)) !== null) {
      const val = match[1] || match[2] || match[3];
      if (val && !results.includes(val)) {
        results.push(val.trim());
      }
    }
  } catch {}
  return results;
}

/** Extracts information for a single file */
function extractFileSkeleton(
  path: string,
  source: string,
  language: string,
  parser?: any
): FileSkeleton {
  try {
    const imports = runRegex(FALLBACK_REGEX.imports[language], source);
    const exports = runRegex(FALLBACK_REGEX.exports[language], source);
    const functionSignatures: string[] = [];

    const funcRegex = FALLBACK_REGEX.functions[language];
    if (funcRegex) {
      try {
        const rx = new RegExp(funcRegex.source, funcRegex.flags);
        let m: RegExpExecArray | null;
        while ((m = rx.exec(source)) !== null) {
          const name = m[1] || m[3] || "anonymous";
          const params = (m[2] || m[4] || "").trim().replace(/\s+/g, " ");
          functionSignatures.push(`${name}(${params})`);
        }
      } catch {}
    }

    return {
      filePath: path,
      imports,
      exports,
      functionSignatures,
    };
  } catch {
    return {
      filePath: path,
      imports: [],
      exports: [],
      functionSignatures: [],
    };
  }
}

/**
 * Main entry point – builds a RepoSkeleton from a map of file paths → raw contents.
 */
export async function buildRepoSkeleton(
  repoUrl: string,
  commitSha: string,
  fileMap: Record<string, string>,
  languageMap: Record<string, any> = {}
): Promise<RepoSkeleton> {
  const files: FileSkeleton[] = [];
  const TreeSitter = getTreeSitter();

  for (const [path, source] of Object.entries(fileMap)) {
    try {
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      let parser: any = undefined;
      if (TreeSitter && languageMap && languageMap[ext]) {
        try {
          parser = new TreeSitter.Parser();
          parser.setLanguage(languageMap[ext]);
        } catch {
          parser = undefined;
        }
      }
      const fileSkeleton = extractFileSkeleton(path, source, ext, parser);
      files.push(fileSkeleton);
    } catch {
      files.push({
        filePath: path,
        imports: [],
        exports: [],
        functionSignatures: [],
      });
    }
  }

  return { repoUrl, commitSha, files };
}
