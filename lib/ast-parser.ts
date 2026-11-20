// lib/ast-parser.ts
/**
 * Client‑side AST parser using web‑tree‑sitter (Web Worker) with lightweight regex fallback.
 * It fetches the repo commit and file tree directly from GitHub, strips function bodies,
 * and extracts a compact RepoSkeleton containing only structural metadata.
 */

import type { RepoSkeleton, FileSkeleton } from "../shared/types";
import { githubApiFetch, fetchRawFileContent } from "@/frontend/src/services/githubService";

export type { RepoSkeleton, FileSkeleton };

/**
 * Extracts owner and repo from various GitHub URL formats.
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } {
  try {
    const cleaned = url.trim().replace(/\.git$/, "");
    const parsed = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      return { owner: segments[0], repo: segments[1] };
    }
  } catch {
    const parts = url.trim().split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
    }
  }
  throw new Error(`Invalid GitHub repository URL: "${url}"`);
}

/**
 * Helper to determine whether a repository file should be included in analysis.
 */
export function shouldIncludeFile(path: string): boolean {
  const lower = path.toLowerCase();
  const validExts = [
    ".js", ".ts", ".tsx", ".jsx", ".py",
    ".cs", ".java", ".cpp", ".c", ".h", ".hpp", ".go", ".rs", ".rb", ".php",
    ".swift", ".kt", ".dart", ".html", ".css", ".vue", ".svelte", ".json", ".yaml", ".yml", ".toml", ".md"
  ];
  const hasValidExt = validExts.some((ext) => lower.endsWith(ext));
  if (!hasValidExt) return false;

  const excludedSegments = [
    "test/", "tests/", "examples/", "benchmarks/", "node_modules/", "dist/",
    "build/", "bin/", "obj/", ".git/", "mocks/", "mock/", "vendor/"
  ];
  const isExcluded = excludedSegments.some(
    (segment) => lower.startsWith(segment) || lower.includes("/" + segment)
  );
  return !isExcluded;
}

/**
 * 1. Fetch the default branch's latest commit SHA via GET /repos/{owner}/{repo}/commits/HEAD
 */
export async function fetchLatestCommitSha(owner: string, repo: string, token?: string): Promise<string> {
  const res = await githubApiFetch(`https://api.github.com/repos/${owner}/${repo}/commits/HEAD`, token);

  const data = await res.json().catch(() => null);
  if (!data?.sha) {
    throw new Error("Could not find commit SHA in GitHub commits/HEAD response");
  }

  return data.sha as string;
}

/**
 * 2. Fetch the recursive file tree via GET /repos/{owner}/{repo}/git/trees/{commitSha}?recursive=1
 * Filters source and config files, excludes dependencies and builds, and caps at 35 files.
 */
export async function fetchFilteredFileTree(
  owner: string,
  repo: string,
  commitSha: string,
  token?: string
): Promise<string[]> {
  const res = await githubApiFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
    token
  );

  const data = await res.json().catch(() => null);
  const tree = Array.isArray(data?.tree) ? data.tree : [];

  if (tree.length === 0) {
    throw new Error("Repository appears to be empty.");
  }

  const matchedPaths: string[] = [];
  for (const item of tree) {
    if (item.type === "blob" && typeof item.path === "string" && shouldIncludeFile(item.path)) {
      matchedPaths.push(item.path);
      if (matchedPaths.length >= 35) {
        break; // Cap at 35 files
      }
    }
  }

  // If no files matched, include any non-binary files so small or unusual repos never return 0 files
  if (matchedPaths.length === 0) {
    const binaryExts = [
      ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf",
      ".eot", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib", ".pdf"
    ];
    for (const item of tree) {
      if (item.type === "blob" && typeof item.path === "string") {
        const lower = item.path.toLowerCase();
        const isBinary = binaryExts.some((ext) => lower.endsWith(ext));
        const isExcluded = ["node_modules/", ".git/", "dist/", "build/", "bin/", "obj/"].some((s) => lower.includes(s));
        if (!isBinary && !isExcluded) {
          matchedPaths.push(item.path);
          if (matchedPaths.length >= 35) break;
        }
      }
    }
  }

  if (matchedPaths.length === 0) {
    throw new Error("Repository appears to be empty.");
  }

  return matchedPaths;
}

/**
 * Fetches raw source code contents for a list of file paths.
 * Uses raw.githubusercontent.com when unauthenticated to avoid exhausting the 60 req/hr rate limit.
 */
export async function fetchFileContents(
  owner: string,
  repo: string,
  commitSha: string,
  filePaths: string[],
  token?: string
): Promise<Record<string, string>> {
  const fileMap: Record<string, string> = {};

  const fetchPromises = filePaths.map(async (filePath) => {
    try {
      const content = await fetchRawFileContent(owner, repo, commitSha, filePath, token);
      if (content !== null) {
        fileMap[filePath] = content;
      }
    } catch (e) {
      console.warn(`Failed to fetch raw file ${filePath}:`, e);
    }
  });

  await Promise.allSettled(fetchPromises);
  return fileMap;
}

/**
 * Fallback regex extractor if Web Worker is unavailable in environment.
 */
function extractSkeletonSynchronous(
  repoUrl: string,
  commitSha: string,
  fileMap: Record<string, string>
): RepoSkeleton {
  const files: FileSkeleton[] = [];

  for (const [filePath, source] of Object.entries(fileMap)) {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

    // Extract imports across JS/TS, Python, C#, Java, Go, C/C++
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|(?:from|import)\s+([a-zA-Z0-9_.]+)(?:\s+import)?|using\s+([a-zA-Z0-9_.]+);|#include\s+[<"]([^>"]+)[>"])/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(source)) !== null) {
      const val = match[1] || match[2] || match[3] || match[4] || match[5];
      if (val && !imports.includes(val)) imports.push(val);
    }

    // Extract exports & class declarations
    const exportRegex = /(?:export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)|exports\.([a-zA-Z0-9_$]+)|class\s+([a-zA-Z0-9_$]+))/g;
    const exports: string[] = [];
    while ((match = exportRegex.exec(source)) !== null) {
      const val = match[1] || match[2] || match[3] || match[4];
      if (val && !exports.includes(val)) exports.push(val);
    }

    // Extract function signatures (bodies stripped) across JS/TS, Python, Go, C#
    const funcRegex = /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>|def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)|func\s+(?:\([^)]+\)\s*)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
    const functionSignatures: string[] = [];
    while ((match = funcRegex.exec(source)) !== null) {
      const name = match[1] || match[3] || match[5] || match[7] || "anonymous";
      const params = (match[2] || match[4] || match[6] || match[8] || "").trim().replace(/\s+/g, " ");
      functionSignatures.push(`${name}(${params})`);
    }

    files.push({
      filePath,
      imports,
      exports,
      functionSignatures,
    });
  }

  return {
    repoUrl,
    commitSha,
    files,
  };
}

/**
 * Parse an already populated fileMap to extract structural skeleton.
 */
export async function parseFiles(
  repoUrl: string,
  commitSha: string,
  fileMap: Record<string, string>
): Promise<RepoSkeleton> {
  const skeleton = extractSkeletonSynchronous(repoUrl, commitSha, fileMap);

  // Assign the final object to window.__REPO_SKELETON__ in browser
  if (typeof window !== "undefined") {
    (window as any).__REPO_SKELETON__ = skeleton;
  }

  return skeleton;
}

/**
 * Full end-to-end repository ingestion and AST stripping.
 * 1. Fetches commit SHA from commits/HEAD
 * 2. Fetches recursive file tree (capped at 30 matching files)
 * 3. Fetches raw files and strips function bodies
 * 4. Assigns to window.__REPO_SKELETON__ and strictly returns { repoUrl, commitSha, files }
 */
export async function parseRepo(repoUrl: string, token?: string): Promise<RepoSkeleton> {
  const { owner, repo } = parseGitHubRepoUrl(repoUrl);

  // 1. Fetch latest commit SHA
  const commitSha = await fetchLatestCommitSha(owner, repo, token);

  // 2. Fetch recursive file tree
  const filePaths = await fetchFilteredFileTree(owner, repo, commitSha, token);

  // 3. Fetch file contents (uses authenticated GitHub API when token is present for private repos)
  const fileMap = await fetchFileContents(owner, repo, commitSha, filePaths, token);

  // 4. Strip bodies via AST worker
  const skeleton = await parseFiles(repoUrl, commitSha, fileMap);

  // Ensure window inspection is set
  if (typeof window !== "undefined") {
    (window as any).__REPO_SKELETON__ = skeleton;
  }

  return skeleton;
}
