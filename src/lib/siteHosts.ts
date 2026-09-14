/**
 * Hostname -> site slug, resolved synchronously.
 *
 * The Convex `scopeForHostname` query is the source of truth for a site's
 * data, but it takes a round trip. Until it resolved, every consumer fell
 * back to the "mhht" default, so hv/swallowtail/spicebush painted a full
 * Hilton Head Timeshares home page for a few hundred milliseconds before
 * swapping to their own branding [scott, 2026-09-14].
 *
 * The hostname is known with zero latency, so the slug can be too. This map
 * only picks the right branding for the first paint; the Convex query still
 * supplies communities, feature flags and everything else.
 *
 * ⚠ Must stay in step with the `domain` / `altDomains` values seeded in
 * `convex/sites.ts`. Convex functions cannot import from `src/`, so this list
 * is a deliberate duplicate. `siteHosts.test-ish` guard: adding a hostname is
 * a THREE-file change (see skills/hht_website — build_vercel_json.py HOSTS,
 * convex/sites.ts altDomains, and this map).
 */

export const HOST_TO_SLUG: Record<string, string> = {
  // Heritage Vacations
  "heritagevacations.com": "heritage",
  "hv.lead-works.com": "heritage",
  "hv.hht.lead-works.com": "heritage",
  // My Hilton Head Timeshare
  "myhiltonheadtimeshare.com": "mhht",
  "hht.lead-works.com": "mhht",
  // Swallowtail at Sea Pines
  "swallowtailatseapines.com": "swallowtail",
  "swallowtail.lead-works.com": "swallowtail",
  "swallowtail.hht.lead-works.com": "swallowtail",
  // Spicebush at Sea Pines
  "spicebushatseapines.com": "spicebush",
  "spicebush.lead-works.com": "spicebush",
  "spicebush.hht.lead-works.com": "spicebush",
};

/** Site names, for the tab title before the query lands. */
export const SLUG_TO_NAME: Record<string, string> = {
  heritage: "Heritage Vacations",
  mhht: "My Hilton Head Timeshare",
  swallowtail: "Swallowtail at Sea Pines",
  spicebush: "Spicebush at Sea Pines",
};

/** The site used for local dev, Vercel preview URLs and anything unmapped. */
export const FALLBACK_SLUG = "mhht";

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");
}

/**
 * Best-guess slug for a hostname, available on the very first render.
 * Unknown hosts (localhost, *.vercel.app) fall back to the full-inventory
 * site, which is the long-standing dev behavior.
 */
export function slugForHostname(hostname: string): string {
  return HOST_TO_SLUG[normalizeHost(hostname)] ?? FALLBACK_SLUG;
}
