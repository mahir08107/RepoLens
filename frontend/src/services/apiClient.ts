// frontend/src/services/apiClient.ts
/**
 * Typed API Client for communicating with the RepoLens backend on Cloud Run.
 */

import type { RepoSkeleton, ArchitectureMap, ChatRequest, ChatResponse } from "@/shared/types";

export const API_BASE_URL: string =
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL)) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "https://repolens-backend-499932337342.asia-south1.run.app";

/**
 * Health check endpoint: GET /health
 */
export async function checkBackendHealth(): Promise<{ status: string; ok: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (res.ok) {
      const data = await res.json().catch(() => ({ status: "UP" }));
      return { status: data.status || "UP", ok: true };
    }
    return { status: `HTTP ${res.status}`, ok: false };
  } catch (err: any) {
    return { status: err?.message || "Unavailable", ok: false };
  }
}

/**
 * Generate an ArchitectureMap from a stripped RepoSkeleton.
 * POST /api/generate-map
 */
export async function generateMapFromBackend(skeleton: RepoSkeleton): Promise<ArchitectureMap> {
  const res = await fetch(`${API_BASE_URL}/api/generate-map`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repoUrl: skeleton.repoUrl,
      commitSha: skeleton.commitSha,
      skeleton,
      files: skeleton.files,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorText =
      (data && typeof data === "object" && (data.error || data.details)) ||
      `Backend error (${res.status})`;
    throw new Error(errorText);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response received from architecture map backend");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  const map: ArchitectureMap = data.architectureMap || data;
  if (!map || !Array.isArray(map.nodes)) {
    throw new Error("Backend response is missing a valid architectureMap nodes array");
  }

  return map;
}

/**
 * Contextual AI Chat Copilot endpoint.
 * POST /api/chat
 */
export async function sendChatToBackend(request: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Cloud Run chat error (${res.status}): ${errorText || res.statusText}`);
  }

  const data: ChatResponse = await res.json();
  return data;
}
