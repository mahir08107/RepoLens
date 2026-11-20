// lib/api-config.ts
/**
 * Resolves the API endpoint for Chat Copilot and Diagram generation.
 *
 * If VITE_API_BASE_URL / NEXT_PUBLIC_API_BASE_URL is explicitly configured and not an unreachable
 * default, it uses that. Otherwise, in the browser it defaults to the local Next.js proxy (/api/chat),
 * which forwards requests to the backend or handles fallback processing gracefully.
 */
export const API_BASE_URL: string = (() => {
  const custom =
    (typeof process !== "undefined" &&
      (process.env.REPOLENS_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.VITE_API_BASE_URL)) ||
    "";

  if (custom && custom.trim().length > 0) {
    return custom.replace(/\/+$/, "");
  }

  // When running locally in development or production without a custom backend URL,
  // route through the local Next.js API route (/api) so browser CORS and 503 errors never break the UI.
  return "";
})();

/**
 * Runtime resolver for server-side Next.js Route Handlers.
 * Prioritizes Vercel's injected service binding (`process.env.BACKEND_URL`) at request time
 * before falling back to configured API_BASE_URL.
 */
export function getBackendUrl(): string {
  if (typeof process !== "undefined" && process.env) {
    const bound = process.env.BACKEND_URL;
    if (bound && bound.trim().length > 0) {
      return bound.replace(/\/+$/, "");
    }
  }
  return API_BASE_URL;
}
