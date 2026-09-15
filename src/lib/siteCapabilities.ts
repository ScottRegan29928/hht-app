/**
 * Which half of the business each site sells.
 *
 * Scott [2026-09-15]: "My Hilton Head Timeshare is going to be sales only.
 * Remove all ability to search for and book rental units. Heritage Vacations
 * is going to be rentals only. Remove all ability to search for and buy units
 * for sale. Keep the nav in both the same, but on hht point Find a Rental to
 * hv, and on hv point Buy a Week to hht."
 *
 * So the two flagship sites each keep BOTH nav items; the one they don't sell
 * is an absolute link to the sister site instead of a local route.
 *
 * ⚠ Resolved from the slug **synchronously**, never from the Convex site
 * query. Gating UI on an async flag is exactly what caused the cross-site
 * flash: the page renders once with the default before the query lands, so a
 * rentals-only site would flash a "Buy a Week" search and vice versa.
 *
 * Swallowtail and Spicebush are untouched — they keep rentals and sales,
 * because their owner portals depend on both.
 */

import { FALLBACK_SLUG } from "./siteHosts";

export type ListingMode = "rent" | "buy";

type Capability = {
  rent: boolean;
  buy: boolean;
};

const CAPABILITIES: Record<string, Capability> = {
  heritage: { rent: true, buy: false },
  mhht: { rent: false, buy: true },
  swallowtail: { rent: true, buy: true },
  spicebush: { rent: true, buy: true },
};

/**
 * Production domain and lead-works staging host for each site, so a cross-site
 * link stays inside the family it was clicked from. Following a link from
 * hht.lead-works.com must not drop the visitor on the live public site.
 */
const CANONICAL_HOSTS: Record<string, { prod: string; staging: string }> = {
  heritage: { prod: "heritagevacations.com", staging: "hv.lead-works.com" },
  mhht: {
    prod: "myhiltonheadtimeshare.com",
    staging: "hht.lead-works.com",
  },
  swallowtail: {
    prod: "swallowtailatseapines.com",
    staging: "swallowtail.lead-works.com",
  },
  spicebush: {
    prod: "spicebushatseapines.com",
    staging: "spicebush.lead-works.com",
  },
};

const PRODUCTION_HOSTS = new Set(
  Object.values(CANONICAL_HOSTS).map((h) => h.prod)
);

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");
}

export function capabilitiesFor(siteSlug: string): Capability {
  return CAPABILITIES[siteSlug] ?? CAPABILITIES[FALLBACK_SLUG];
}

export function siteSells(siteSlug: string, mode: ListingMode): boolean {
  return capabilitiesFor(siteSlug)[mode];
}

/** The site that handles `mode` when the current site does not. */
export function siteForMode(mode: ListingMode): string {
  return mode === "rent" ? "heritage" : "mhht";
}

/**
 * Absolute URL to a sister site, keeping the current host family. Anything
 * unrecognized (localhost, *.vercel.app previews) uses the lead-works hosts,
 * which are the ones that always exist.
 */
export function sisterSiteUrl(
  targetSlug: string,
  path: string,
  hostname: string
): string {
  const entry = CANONICAL_HOSTS[targetSlug];
  if (!entry) return path;
  const host = PRODUCTION_HOSTS.has(normalizeHost(hostname))
    ? entry.prod
    : entry.staging;
  return `https://${host}${path}`;
}

export type ModeLink = {
  href: string;
  /** True when the link leaves this site for its sister. */
  external: boolean;
};

/**
 * Where "Find a Rental" / "Buy a Week" should point from this site: a local
 * search route when the site sells it, the sister site when it does not.
 */
export function linkForMode(
  siteSlug: string,
  mode: ListingMode,
  hostname: string,
  path = `/search?type=${mode}`
): ModeLink {
  if (siteSells(siteSlug, mode)) return { href: path, external: false };
  return {
    href: sisterSiteUrl(siteForMode(mode), path, hostname),
    external: true,
  };
}

/** Convenience for components that only have the slug. */
export function currentHostname(): string {
  return typeof window === "undefined" ? "" : window.location.hostname;
}

/**
 * Rewrites an admin-authored or default CTA href so it still works on a
 * single-purpose site: "/search?type=buy" on a rentals-only site becomes the
 * sister site's buy search. Anything that isn't a local search link is left
 * exactly as written.
 */
export function resolveSearchHref(
  siteSlug: string,
  href: string,
  hostname: string
): ModeLink {
  const match = /^\/search\?(?:.*&)?type=(rent|buy)\b/.exec(href);
  if (!match) return { href, external: false };
  const mode = match[1] as ListingMode;
  if (siteSells(siteSlug, mode)) return { href, external: false };
  return {
    href: sisterSiteUrl(siteForMode(mode), href, hostname),
    external: true,
  };
}

/**
 * The only listing mode a site offers, or null when it offers both. Search is
 * hard-locked to this: a single-purpose site must never be able to search the
 * other half, whatever the URL asks for [scott, 2026-09-15].
 */
export function lockedModeFor(siteSlug: string): ListingMode | null {
  const caps = capabilitiesFor(siteSlug);
  if (caps.rent === caps.buy) return null;
  return caps.rent ? "rent" : "buy";
}
