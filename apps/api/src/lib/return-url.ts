/** Appends query params to a base URL, respecting an existing query string. */
export function appendQuery(base: string, params: Record<string, string>): string {
  const separator = base.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${base}${separator}${query}`;
}

/**
 * Resolves the post-checkout redirect target. Only the app's own deep-link
 * scheme or an allowlisted web origin is accepted (prevents open redirects);
 * anything else falls back to the native deep link.
 */
export function resolveCallbackUrl(params: {
  requested: string | undefined;
  fallbackBase: string;
  query: Record<string, string>;
  allowedOrigins: string[];
}): string {
  const { requested, fallbackBase, query, allowedOrigins } = params;
  if (requested) {
    try {
      const url = new URL(requested);
      const allowed = allowedOrigins.map((origin) => origin.trim().replace(/\/$/, ""));
      if (url.protocol === "fightfind:" || allowed.includes(url.origin)) {
        return appendQuery(requested, query);
      }
    } catch {
      // Invalid URL — fall through to the deep link.
    }
  }
  return appendQuery(fallbackBase, query);
}
