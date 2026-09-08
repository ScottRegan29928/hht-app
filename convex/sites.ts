import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Multi-site foundation.
 *
 * One deployment serves four hostnames. Everything about "which site am I?"
 * resolves through here so no page has to know about domains.
 *
 * Scoping rule: a site's inventory is defined by COMMUNITY, never by tagging
 * individual properties. Adding a property to Spicebush community automatically
 * puts it on the Spicebush site.
 */

/** Strip port, lowercase, drop a leading www. so previews resolve too. */
function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().split(":")[0].replace(/^www\./, "");
}

/** Default site used when a hostname doesn't match (local dev, previews). */
const FALLBACK_SITE_SLUG = "mhht";

export const getByHostname = query({
  args: { hostname: v.string() },
  handler: async (ctx, { hostname }) => {
    const host = normalizeHost(hostname);
    const all = await ctx.db.query("sites").collect();

    const exact = all.find(
      (s) => s.isActive && normalizeHost(s.domain) === host
    );
    if (exact) return exact;

    const alt = all.find(
      (s) =>
        s.isActive &&
        (s.altDomains ?? []).some((d) => normalizeHost(d) === host)
    );
    if (alt) return alt;

    return all.find((s) => s.slug === FALLBACK_SITE_SLUG) ?? null;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
});

export const listSites = query({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    return sites.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

/**
 * Resolve a site to the set of community IDs whose properties it may show.
 * Returns null when the site shows everything (HV + MHHT).
 */
export async function communityIdsForSite(
  ctx: { db: any },
  site: Doc<"sites"> | null
): Promise<string[] | null> {
  if (!site || site.scopeMode === "all") return null;
  const slugs = site.communitySlugs ?? [];
  if (slugs.length === 0) return [];
  const communities = await ctx.db.query("communities").collect();
  return communities
    .filter((c: Doc<"communities">) => slugs.includes(c.slug))
    .map((c: Doc<"communities">) => c._id as string);
}

/** Query helper used by pages: which communities does this hostname show? */
export const scopeForHostname = query({
  args: { hostname: v.string() },
  handler: async (ctx, { hostname }) => {
    const host = normalizeHost(hostname);
    const all = await ctx.db.query("sites").collect();
    const site =
      all.find((s) => s.isActive && normalizeHost(s.domain) === host) ??
      all.find(
        (s) =>
          s.isActive &&
          (s.altDomains ?? []).some((d) => normalizeHost(d) === host)
      ) ??
      all.find((s) => s.slug === FALLBACK_SITE_SLUG) ??
      null;

    if (!site) return null;
    const communityIds = await communityIdsForSite(ctx, site);
    return { site, communityIds };
  },
});

export const updateSite = mutation({
  args: {
    id: v.id("sites"),
    patch: v.object({
      name: v.optional(v.string()),
      domain: v.optional(v.string()),
      altDomains: v.optional(v.array(v.string())),
      tagline: v.optional(v.string()),
      isActive: v.optional(v.boolean()),
      ownerPortalEnabled: v.optional(v.boolean()),
      marketplaceEnabled: v.optional(v.boolean()),
      rentalsEnabled: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

/** Idempotent seed of the four sister sites. */
export const seedSites = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    const now = Date.now();
    const defs = [
      {
        slug: "heritage",
        name: "Heritage Vacations",
        domain: "heritagevacations.com",
        altDomains: ["hv.hht.lead-works.com"],
        scopeMode: "all" as const,
        communitySlugs: undefined,
        ownerPortalEnabled: false,
        marketplaceEnabled: false,
        rentalsEnabled: true,
        marketplacePool: undefined,
        sortOrder: 1,
      },
      {
        slug: "mhht",
        name: "My Hilton Head Timeshare",
        domain: "myhiltonheadtimeshare.com",
        altDomains: ["hht.lead-works.com"],
        scopeMode: "all" as const,
        communitySlugs: undefined,
        ownerPortalEnabled: false,
        marketplaceEnabled: false,
        rentalsEnabled: true,
        marketplacePool: undefined,
        sortOrder: 2,
      },
      {
        slug: "swallowtail",
        name: "Swallowtail at Sea Pines",
        domain: "swallowtailatseapines.com",
        altDomains: ["swallowtail.hht.lead-works.com"],
        scopeMode: "communities" as const,
        communitySlugs: ["swallowtail-at-sea-pines"],
        ownerPortalEnabled: true,
        marketplaceEnabled: true,
        rentalsEnabled: true,
        marketplacePool: "seapines-joint",
        // Swallowtail does not take payments on the website [scott, 2026-09-08].
        paymentMode: "external" as const,
        paymentUrl: "https://secure2.irm1.net/owner/#/login?resort=f4",
        sortOrder: 3,
      },
      {
        slug: "spicebush",
        name: "Spicebush at Sea Pines",
        domain: "spicebushatseapines.com",
        altDomains: ["spicebush.hht.lead-works.com"],
        scopeMode: "communities" as const,
        communitySlugs: ["spicebush"],
        ownerPortalEnabled: true,
        marketplaceEnabled: true,
        rentalsEnabled: true,
        marketplacePool: "seapines-joint",
        // Spicebush collects on site via Square [scott, 2026-09-08].
        // paymentUrl stays empty until the client's Square link is supplied;
        // the page then tells owners to call rather than showing a dead button.
        paymentMode: "square_link" as const,
        sortOrder: 4,
      },
    ];

    // Validate community slugs exist before writing anything.
    const communities = await ctx.db.query("communities").collect();
    const known = new Set(communities.map((c) => c.slug));
    const bad: string[] = [];
    for (const d of defs) {
      for (const s of d.communitySlugs ?? []) {
        if (!known.has(s)) bad.push(`${d.slug} -> ${s}`);
      }
    }
    if (bad.length) {
      throw new Error(`Unknown community slugs: ${bad.join(", ")}`);
    }

    const results: string[] = [];
    for (const d of defs) {
      const existing = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", d.slug))
        .unique();
      if (existing) {
        if (!dryRun) {
          await ctx.db.patch(existing._id, { ...d, updatedAt: now });
        }
        results.push(`update ${d.slug}`);
      } else {
        if (!dryRun) {
          await ctx.db.insert("sites", { ...d, isActive: true, createdAt: now });
        }
        results.push(`insert ${d.slug}`);
      }
    }
    return { dryRun: !!dryRun, results };
  },
});

/**
 * Server-side scoping primitive shared by every public listing query.
 *
 * Returns the set of community IDs a site may show, or null for "all".
 * Callers must treat null and empty-set differently: null means unscoped,
 * an empty set means the site is scoped to nothing and should return no rows.
 */
export async function allowedCommunityIds(
  ctx: { db: any },
  siteSlug?: string
): Promise<Set<string> | null> {
  if (!siteSlug) return null;
  const site = await ctx.db
    .query("sites")
    .withIndex("by_slug", (q: any) => q.eq("slug", siteSlug))
    .unique();
  if (!site || site.scopeMode === "all") return null;
  const slugs = new Set(site.communitySlugs ?? []);
  const communities = await ctx.db.query("communities").collect();
  return new Set(
    communities
      .filter((c: any) => slugs.has(c.slug))
      .map((c: any) => c._id as string)
  );
}
