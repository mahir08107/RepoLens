// app/api/diagram/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RepoSkeleton } from "@/shared/types";

/**
 * Very small helper to extract owner/repo from a GitHub URL.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch the default branch name using the GitHub REST API.
 */
async function fetchDefaultBranch(owner: string, repo: string, token?: string) {
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `token ${token}`;
  const res = await fetch(api, { headers });
  if (!res.ok) throw new Error(`GitHub repo lookup failed (${res.status})`);
  const data = await res.json();
  return data.default_branch as string;
}

/**
 * Build a very simple placeholder Mermaid diagram and dummy colour mapping.
 * In a production implementation this would call Gemini with the structural
 * skeleton, but for brevity we return a deterministic placeholder.
 */
function buildPlaceholder(repoUrl: string): {
  mermaidDefinition: string;
  groupColors: Record<string, string>;
  skeleton: RepoSkeleton;
} {
  const mermaidDefinition = `graph TD\nA[Repository] --> B[Modules]`;
  const groupColors = { Repository: "#A0C4FF", Modules: "#B5E48C" };
  const skeleton: RepoSkeleton = { repoUrl, commitSha: "unknown", files: [], edges: [] };
  return { mermaidDefinition, groupColors, skeleton };
}

export async function POST(request: NextRequest) {
  try {
    const { repoUrl } = await request.json();
    if (!repoUrl) return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });

    // Optional GitHub token for higher rate limits.
    const githubToken = process.env.GITHUB_TOKEN;

    // Fetch default branch just to validate repo existence.
    await fetchDefaultBranch(parsed.owner, parsed.repo, githubToken);

    const { mermaidDefinition, groupColors, skeleton } = buildPlaceholder(repoUrl);
    return NextResponse.json({ mermaidDefinition, groupColors, skeleton });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
