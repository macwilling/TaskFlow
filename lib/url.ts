/**
 * Build a tenant-scoped absolute URL.
 *
 * Local dev (no BASE_DOMAIN or BASE_DOMAIN starts with "localhost"):
 *   → http://localhost:3000{path}   (subdomains don't work on localhost)
 *
 * Production (BASE_DOMAIN set):
 *   → https://{slug}.{BASE_DOMAIN}{path}
 */
export function tenantUrl(slug: string, path = ""): string {
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000";
  const origin = base.startsWith("localhost")
    ? `http://${base}`
    : `https://${slug}.${base}`;
  return `${origin}${path}`;
}

/**
 * Build a tenant-scoped portal URL.
 *
 * Local dev:  http://localhost:3000/portal{path}
 * Production: https://{slug}.{BASE_DOMAIN}/portal{path}
 */
export function portalUrl(slug: string, path = ""): string {
  return tenantUrl(slug, `/portal${path}`);
}
