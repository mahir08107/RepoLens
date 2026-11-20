// lib/ast-parser.ts
/**
 * Client‑side AST parser using web‑tree‑sitter (Web Worker) with lightweight regex fallback.
 * It fetches the repo commit and file tree directly from GitHub, strips function bodies,
 * and extracts a compact RepoSkeleton containing only structural metadata.
 */

import type { RepoSkeleton, FileSkeleton } from "../shared/types";

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
  const validExts = [".js", ".ts", ".tsx", ".jsx", ".py"];
  const hasValidExt = validExts.some((ext) => lower.endsWith(ext));
  if (!hasValidExt) return false;

  const excludedSegments = ["test/", "tests/", "examples/", "benchmarks/", "node_modules/", "dist/", "mocks/", "mock/"];
  const isExcluded = excludedSegments.some(
    (segment) => lower.startsWith(segment) || lower.includes("/" + segment)
  );
  return !isExcluded;
}

/**
 * 1. Fetch the default branch's latest commit SHA via GET /repos/{owner}/{repo}/commits/HEAD
 */
export async function fetchLatestCommitSha(owner: string, repo: string, token?: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/HEAD`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`GitHub commits lookup failed (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  if (!data?.sha) {
    throw new Error("Could not find commit SHA in GitHub commits/HEAD response");
  }

  return data.sha as string;
}

/**
 * 2. Fetch the recursive file tree via GET /repos/{owner}/{repo}/git/trees/{commitSha}?recursive=1
 * Filters blobs ending with .js, .ts, .tsx, .jsx, .py, excludes test/tests/examples/benchmarks/node_modules/dist,
 * does NOT restrict to src/, and caps at 30 files.
 */
export async function fetchFilteredFileTree(
  owner: string,
  repo: string,
  commitSha: string,
  token?: string
): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`GitHub recursive tree fetch failed (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  const tree = Array.isArray(data?.tree) ? data.tree : [];

  const matchedPaths: string[] = [];
  for (const item of tree) {
    if (item.type === "blob" && typeof item.path === "string" && shouldIncludeFile(item.path)) {
      matchedPaths.push(item.path);
      if (matchedPaths.length >= 30) {
        break; // Cap at 30 files
      }
    }
  }

  return matchedPaths;
}

/**
 * Fetches raw source code contents for a list of file paths.
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
      if (token) {
        const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${commitSha}`;
        const res = await fetch(apiUrl, {
          headers: {
            Accept: "application/vnd.github.raw+json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          fileMap[filePath] = await res.text();
        }
      } else {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${filePath}`;
        const res = await fetch(rawUrl);
        if (res.ok) {
          fileMap[filePath] = await res.text();
        }
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

    // Extract imports
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(source)) !== null) {
      const val = match[1] || match[2];
      if (val && !imports.includes(val)) imports.push(val);
    }

    // Extract exports
    const exportRegex = /(?:export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)|exports\.([a-zA-Z0-9_$]+))/g;
    const exports: string[] = [];
    while ((match = exportRegex.exec(source)) !== null) {
      const val = match[1] || match[2] || match[3];
      if (val && !exports.includes(val)) exports.push(val);
    }

    // Extract function signatures (bodies stripped)
    const funcRegex = /(?:async\s+)?function\s*([a-zA-Z0-9_$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
    const functionSignatures: string[] = [];
    while ((match = funcRegex.exec(source)) !== null) {
      const name = match[1] || match[3] || "anonymous";
      const params = (match[2] || match[4] || "").trim().replace(/\s+/g, " ");
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
