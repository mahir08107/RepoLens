// frontend/src/services/githubService.ts
/**
 * Robust GitHub API & raw file fetcher.
 * Handles automatic 401/403 token fallback, stale credential cleanup,
 * unauthenticated raw.githubusercontent.com fetching, and actionable error messages.
 */

export function isValidGitHubToken(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== "undefined" &&
    trimmed !== "null" &&
    trimmed !== "false"
  );
}

export function clearStaleGitHubToken(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem("repolens_gh_token");
      window.sessionStorage.removeItem("repolens_github_token");
      window.sessionStorage.removeItem("repolens_gh_username");
    } catch {}
  }
}

/**
 * Executes a GitHub API request with automatic 401/403 retry without Authorization,
 * stale token clearing, and exact actionable error messages.
 */
export async function githubApiFetch(
  url: string,
  token?: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const hasToken = isValidGitHubToken(token);
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/vnd.github.v3+json");

  if (hasToken) {
    headers.set("Authorization", `Bearer ${token.trim()}`);
  }

  let res = await fetch(url, { ...options, headers });

  // 1. Automatic Public Fallback on 401 (Bad credentials) or 403
  if (hasToken && (res.status === 401 || res.status === 403)) {
    console.warn(
      `[GitHub API] Token returned HTTP ${res.status}. Clearing stale token and retrying as public request...`
    );
    clearStaleGitHubToken();

    const publicHeaders = new Headers(options.headers || {});
    publicHeaders.set("Accept", "application/vnd.github.v3+json");
    publicHeaders.delete("Authorization");

    try {
      const retryRes = await fetch(url, { ...options, headers: publicHeaders });
      if (retryRes.ok || retryRes.status !== 401) {
        res = retryRes;
      }
    } catch (retryErr) {
      console.warn("[GitHub API] Public retry notice:", retryErr);
    }
  }

  // 2. Actionable Error Mapping
  if (!res.ok) {
    const rateRemaining = res.headers.get("x-ratelimit-remaining");
    const isRateLimited =
      res.status === 403 &&
      (rateRemaining === "0" || res.headers.get("x-ratelimit-reset") !== null);

    if (isRateLimited) {
      throw new Error(
        "GitHub API rate limit reached (60/hr). Click 'Sign in with GitHub' in the top-right for 5,000 req/hr."
      );
    }

    if (res.status === 404) {
      throw new Error(
        "Repository not found or is private. Sign in with GitHub to access private repositories."
      );
    }

    if (res.status === 401) {
      throw new Error(
        "GitHub credentials expired or invalid. Please sign out and sign in again."
      );
    }

    const errJson = await res.json().catch(() => null);
    const detailMsg = errJson?.message || `GitHub HTTP ${res.status}: ${res.statusText}`;
    throw new Error(detailMsg);
  }

  return res;
}

/**
 * Fetches raw source code contents for a given file.
 * Prioritizes raw.githubusercontent.com when unauthenticated (zero REST API rate limit impact).
 */
export async function fetchRawFileContent(
  owner: string,
  repo: string,
  commitSha: string,
  filePath: string,
  token?: string | null
): Promise<string | null> {
  const hasToken = isValidGitHubToken(token);

  // If unauthenticated or token is not valid, use raw.githubusercontent.com directly
  if (!hasToken) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${filePath}`;
      const res = await fetch(rawUrl);
      if (res.ok) {
        return await res.text();
      }
    } catch {}
    return null;
  }

  // If token is provided (e.g. private repo), try authenticated API first
  try {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${commitSha}`;
    const res = await githubApiFetch(apiUrl, token, {
      headers: {
        Accept: "application/vnd.github.raw+json",
      },
    });
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // Fallback to raw.githubusercontent.com if it turns out to be public
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${filePath}`;
      const res = await fetch(rawUrl);
      if (res.ok) {
        return await res.text();
      }
    } catch {}
  }

  return null;
}
