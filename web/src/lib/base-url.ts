import { headers } from "next/headers";

/**
 * Returns the base URL for server-side self-fetches.
 * Derives it from the incoming request headers so it works
 * regardless of which port Next.js picks.
 */
export async function baseUrl(): Promise<string> {
  // Try explicit env first (production deployments)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  // Derive from incoming request headers (works with any port)
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") || "http";
      return `${proto}://${host}`;
    }
  } catch {
    // headers() not available outside request context
  }

  return "http://localhost:3000";
}
