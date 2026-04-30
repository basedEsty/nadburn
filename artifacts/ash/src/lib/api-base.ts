// Resolves the base URL of our backend api-server at build time.
//
// In development the frontend and api-server live on the same Replit
// host and the shared proxy on port 80 routes `/api/*` to the api-server,
// so callers can use plain relative URLs and `VITE_API_BASE_URL` stays
// unset.
//
// In production the frontend is hosted on Vercel (nadburn.xyz) and the
// api-server is hosted on Replit Deployments. Vercel doesn't know
// anything about `/api/*` routes, so unset relative URLs land on the
// Vercel SPA and return Vercel's own 404 page (the violet "NOT_FOUND
// iad1::…" blob users were seeing). Set `VITE_API_BASE_URL` to the
// deployed Replit URL — e.g. `https://nadburn-api.replit.app` — and every
// frontend `apiUrl(...)` call resolves to an absolute URL pointing at
// the api-server.
//
// Trailing slashes on the env var are tolerated so deploy configs don't
// have to care.
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const NORMALIZED_BASE = RAW_BASE.replace(/\/+$/, "");

export const API_BASE_URL = NORMALIZED_BASE;

/**
 * Build a URL for one of our api-server endpoints. Pass any path that
 * starts with `/api/...` (or any other path the api-server serves).
 *
 *   apiUrl("/api/uniswap/quote")
 *   apiUrl("/api/burn-history")
 *
 * When `VITE_API_BASE_URL` is unset this returns the path verbatim, so
 * dev preview keeps using same-origin relative URLs.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    // Defensive: callers should pass a leading slash so we never accidentally
    // build `https://hosthelloapi/...`. Add one if they forgot.
    path = `/${path}`;
  }
  return `${NORMALIZED_BASE}${path}`;
}
