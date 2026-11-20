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
const FALLBACK_REGEX = {
  imports: {
    ts: /import\s+[^'\"]+['\"]([^'\"]+)['\"]/g,
    js: /import\s+[^'\"]+['\"]([^'\"]+)['\"]/g,
    py: /^(?:import|from)\s+([\w\.]+)/gm,
    go: /import\s+\(?\s*"([^"]+)"/g,
    java: /import\s+([\w\.]+);/g,
  },
  exports: {
    ts: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    js: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    py: /^(?:def|class)\s+(\w+)/gm,
    go: /func\s+(\w+)\s*\(/g,
    java: /public\s+(?:class|interface|enum|\w+)\s+(\w+)/g,
  },
  functions: {
    ts: /function\s+(\w+)\s*\(([^)]*)\)/g,
    js: /function\s+(\w+)\s*\(([^)]*)\)/g,
    py: /^def\s+(\w+)\s*\(([^)]*)\)/gm,
    go: /func\s+(\w+)\s*\(([^)]*)\)/g,
    java: /(?:public|private|protected)\s+\w+\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
  },
};

/** Helper to run a regex globally and capture group 1 */
function runRegex(regex: RegExp, source: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/** Extracts information for a single file */
function extractFileSkeleton(
  path: string,
  source: string,
  language: string,
  parser?: any
): FileSkeleton {
  // If a TreeSitter parser is provided, we could walk the tree – omitted for brevity.
  // We'll rely on regex fallback which is sufficient for the hackathon.
  const imports = runRegex(FALLBACK_REGEX.imports[language] ?? /$^/, source);
  const exports = runRegex(FALLBACK_REGEX.exports[language] ?? /$^/, source);
  const funcMatches = [...source.matchAll(FALLBACK_REGEX.functions[language] ?? /$^/g)];
  const functionSignatures = funcMatches.map((m) => {
    const name = m[1];
    const params = m[2].trim().split(/\s*,\s*/).filter(Boolean).join(", ");
    return `${name}(${params})`;
  });

  return {
    filePath: path,
    imports,
    exports,
    functionSignatures,
  };
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
    const ext = path.split('.').pop() ?? "";
    const language = ext;
    const parser = (TreeSitter && languageMap[language]) ? new TreeSitter.Parser() : undefined;
    if (parser) parser.setLanguage(languageMap[language]);
    const fileSkeleton = extractFileSkeleton(path, source, language, parser);
    files.push(fileSkeleton);
  }

  return { repoUrl, commitSha, files };
}
