// ── SEO rules shared by the client (src/lib/seo.ts callers) and the crawler
// prerender (convex/prerender.ts). One module so the two can never drift —
// a crawler must see the same title/description/canonical a visitor does.
//
// Pure data + pure functions only: this file is imported by the browser bundle.

/**
 * Sister-site keyword plan [scott, 2026-10-08]. All four sites sell the same
 * villas, so without rules they compete with near-identical pages:
 *   - swallowtail OWNS Sea Pines + island-wide vacation/villa rental terms
 *     (the SEO landing pages in seoLandingData.ts).
 *   - spicebush ranks for its own brand + Spicebush-specific terms only.
 *   - heritage (HV) ranks for its brand and the multi-resort, island-wide
 *     timeshare-rental inventory; it never clones a Swallowtail landing page.
 *   - a villa that belongs to a resort site has ONE canonical URL: the resort
 *     site's /property/<slug>. HV/mhht copies point their canonical there and
 *     drop out of their own sitemaps (once that resort's new site is live).
 */
export const RESORT_COMMUNITY_SITE: Record<string, { siteSlug: string; domain: string }> = {
  "swallowtail-at-sea-pines": { siteSlug: "swallowtail", domain: "swallowtailatseapines.com" },
  spicebush: { siteSlug: "spicebush", domain: "spicebushatseapines.com" },
};

/**
 * ⚠ GO-LIVE SWITCH. Flip a resort to true on the day its domain is cut over to
 * this app. Until then its old WordPress site answers on the domain, and a
 * cross-domain canonical would point Google at a URL that 404s there.
 */
export const RESORT_SITE_LIVE: Record<string, boolean> = {
  swallowtail: false,
  spicebush: false,
};

/** Cross-domain canonical for a villa shown on a site that doesn't own it. */
export function propertyCanonicalOverride(
  currentSiteSlug: string,
  communitySlug: string | undefined,
  propertySlug: string
): string | undefined {
  const owner = communitySlug ? RESORT_COMMUNITY_SITE[communitySlug] : undefined;
  if (!owner || owner.siteSlug === currentSiteSlug) return undefined;
  if (!RESORT_SITE_LIVE[owner.siteSlug]) return undefined;
  return `https://${owner.domain}/property/${propertySlug}`;
}

type PropertyLike = {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  sleeps?: number;
  description?: string;
};

function plain(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).trimEnd() + "…";
}

/** Villa page title + description (no site suffix). */
export function propertySeo(p: PropertyLike, communityName?: string, siteSlug?: string) {
  const beds = p.bedrooms ? `${p.bedrooms}-Bedroom ` : "";
  const known = communityName && communityName !== "Unknown" ? communityName : undefined;
  // "2871 Swallowtail at Swallowtail at Sea Pines" reads badly: skip the
  // community when the address already starts with its first word.
  const redundant = !!known && p.address.toLowerCase().includes(known.split(" ")[0].toLowerCase());
  const where = known && !redundant ? ` at ${known}` : "";
  const area = known && /sea pines/i.test(known) ? "Sea Pines" : "Hilton Head";
  const title = `${p.address}: ${beds}${area} Villa${siteSlug === "mhht" ? "" : " Rental"}${where}`;
  const facts = [
    p.bedrooms ? `${p.bedrooms} bedrooms` : undefined,
    p.bathrooms ? `${p.bathrooms} baths` : undefined,
    p.sleeps ? `sleeps ${p.sleeps}` : undefined,
  ].filter(Boolean);
  const lead = `${p.address}${known ? (redundant ? `, ${known}` : where) : ""}, Hilton Head Island, SC${facts.length ? " — " + facts.join(", ") : ""}.`;
  const description = plain(`${lead} ${p.description ?? ""}`, 158) ?? lead;
  return { title, description };
}

/** /search page title per site. */
export function searchTitle(siteSlug: string, siteName: string): string {
  if (siteSlug === "heritage") return "Search Hilton Head Vacation Rentals";
  if (siteSlug === "mhht") return "Hilton Head Timeshare Weeks for Sale";
  return `Search ${siteName} Villas`;
}

export function searchDescription(siteSlug: string, siteName: string): string {
  if (siteSlug === "heritage")
    return "Search Hilton Head Island villa rentals with live availability and online booking across every Heritage Vacations resort.";
  if (siteSlug === "mhht")
    return "Browse Hilton Head Island timeshare weeks for sale by resort, week number and villa size.";
  return `Search ${siteName} villas: live rental availability, online booking and timeshare weeks for sale in Sea Pines, Hilton Head Island.`;
}
