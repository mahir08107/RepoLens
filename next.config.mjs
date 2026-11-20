/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Exposes the backend URL to client components. Accepts the Vite-style variable name
    // (VITE_API_BASE_URL) as well as NEXT_PUBLIC_API_BASE_URL from the repo-root .env files.
    REPOLENS_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || "",
  },
};

export default nextConfig;

