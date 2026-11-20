// lib/api-config.ts
/**
 * Resolves the API endpoint for Chat Copilot and Architecture Map generation.
 *
 * In static exports (Firebase Hosting), frontend components call the external
 * backend URL defined by NEXT_PUBLIC_API_BASE_URL or VITE_API_BASE_URL.
 */
export const API_BASE_URL: string = (() => {
  const custom =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.REPOLENS_API_BASE_URL ||
        process.env.VITE_API_BASE_URL)) ||
    "";

  if (custom && custom.trim().length > 0) {
    return custom.replace(/\/+$/, "");
  }

  // When deployed to production (Firebase Hosting), default to Vercel production backend
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return "https://repolens-three-sable.vercel.app";
  }

  return "http://localhost:8080";
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
