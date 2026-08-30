import { env } from "cloudflare:workers";
/** Use deployment-managed configuration, never a forwarded Host header. */
export function siteOrigin(): URL | undefined {
  const configured = env.SITE_ORIGIN;
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        url.protocol === "https:" ||
        (import.meta.env.DEV && url.hostname === "localhost")
      )
        return new URL(url.origin);
    } catch {}
  }
  return import.meta.env.DEV ? new URL("http://localhost:3000") : undefined;
}
