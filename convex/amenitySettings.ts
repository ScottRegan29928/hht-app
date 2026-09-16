/**
 * The amenity filter registry [scott, 2026-09-16].
 *
 *   "in the admin portal, to allow the admin to toggle on and off amenities
 *    for a page, and also toggle on and off amenities that will be used as
 *    search filters"
 *   "Across all four but with the ability to toggle on and off per site."
 *
 * Two separate controls, deliberately not shared:
 *
 *   FILTERS  — this file. One global list, per-site opt-out. Stored in
 *              `amenitySettings`, keyed by amenity id.
 *   PAGE      — `properties.hiddenAmenities`, per property, display only.
 *
 * Keeping them apart matters: hiding "Baking sheet" from one villa's page must
 * never change which villas a filter returns, or the admin would be silently
 * editing search results while tidying copy.
 */

import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  SEARCH_FACETS,
  FACET_IDS,
  amenityLabelFor,
  rawTagId,
  isRawTagId,
  resolveAllAmenityIds,
} from "./searchFacets";
import { defaultFilterEnabled, isFilterableOnSite } from "./amenityDefaults";

/**
 * Same shape every other admin module in this codebase uses. There is no
 * shared adminAuth module yet — at least eight files define their own — so
 * this matches ownerNotices.ts rather than inventing a ninth variant.
 */
async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  const adminRoles = ["admin", "admin_user", "admin_rental", "admin_sales"];
  if (!profile || !adminRoles.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

/** All setting rows as a map, for cheap repeated lookups. */
async function settingsMap(ctx: QueryCtx) {
  const rows = await ctx.db.query("amenitySettings").collect();
  return new Map(rows.map((r) => [r.amenityId, r]));
}

/**
 * Which amenity ids are active filters on this site.
 *
 * Curated facets keep their SEARCH_FACETS order (Scott's list is alphabetical
 * by label and the UI renders it verbatim); promoted raw tags follow, sorted
 * by label, so a newly promoted tag lands somewhere predictable.
 */
export const filterableForSite = query({
  args: { siteSlug: v.optional(v.string()) },
  handler: async (ctx, { siteSlug }) => {
    const map = await settingsMap(ctx);

    const facets = FACET_IDS.filter((id) =>
      isFilterableOnSite(id, map.get(id), siteSlug),
    );

    const promoted = [...map.values()]
      .filter((r) => isRawTagId(r.amenityId))
      .filter((r) => isFilterableOnSite(r.amenityId, r, siteSlug))
      .map((r) => r.amenityId)
      .sort((a, b) => amenityLabelFor(a).localeCompare(amenityLabelFor(b)));

    return [...facets, ...promoted].map((id) => ({
      id,
      label: amenityLabelFor(id),
    }));
  },
});

/**
 * Admin registry view: every amenity the account knows about, with its global
 * state, per-site opt-outs, and how many live properties actually match it.
 *
 * The count is the point of this screen — it is what stops someone enabling a
 * filter that returns nothing (Shuffleboard matches 0 of 82) or one that
 * matches everything and so filters nothing (Balcony matches 81).
 */
export const listRegistry = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const map = await settingsMap(ctx);

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const commCache = new Map<string, string[]>();
    const counts = new Map<string, number>();
    for (const p of properties) {
      const key = p.communityId as string;
      if (!commCache.has(key)) {
        const comm = await ctx.db.get(p.communityId);
        commCache.set(key, comm?.amenities ?? []);
      }
      for (const id of resolveAllAmenityIds(
        p.amenityTags,
        commCache.get(key),
        p.facetOverrides,
      )) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    // Universe = the twelve curated facets (always listed, even at 0 matches,
    // because an admin may be about to supply the data) + every raw tag seen
    // in inventory + any id someone has already saved a decision for.
    const ids = new Set<string>([...FACET_IDS, ...counts.keys(), ...map.keys()]);

    const rows = [...ids].map((id) => {
      const row = map.get(id);
      return {
        id,
        label: amenityLabelFor(id),
        kind: isRawTagId(id) ? ("tag" as const) : ("facet" as const),
        matchCount: counts.get(id) ?? 0,
        totalProperties: properties.length,
        filterEnabled: row ? row.filterEnabled : defaultFilterEnabled(id),
        siteDisabled: row?.siteDisabled ?? [],
        isDefault: !row,
        note: SEARCH_FACETS.find((f) => f.id === id)?.note,
      };
    });

    // Facets first in curated order, then raw tags by label.
    const facetOrder = new Map(FACET_IDS.map((id, i) => [id, i]));
    rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "facet" ? -1 : 1;
      if (a.kind === "facet") {
        return (facetOrder.get(a.id) ?? 99) - (facetOrder.get(b.id) ?? 99);
      }
      return a.label.localeCompare(b.label);
    });
    return rows;
  },
});

/** Turn an amenity into a filter, or off, across all four sites. */
export const setFilterEnabled = mutation({
  args: { amenityId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { amenityId, enabled }) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("amenitySettings")
      .withIndex("by_amenity", (q) => q.eq("amenityId", amenityId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        filterEnabled: enabled,
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
      return { amenityId, enabled };
    }
    await ctx.db.insert("amenitySettings", {
      amenityId,
      filterEnabled: enabled,
      siteDisabled: [],
      updatedAt: Date.now(),
      updatedBy: admin._id,
    });
    return { amenityId, enabled };
  },
});

/**
 * Opt one site out of a globally-enabled amenity, or back in.
 *
 * `enabled: false` adds the slug to siteDisabled. There is no per-site opt-IN
 * for something disabled globally — see the note in amenityDefaults.ts.
 */
export const setSiteEnabled = mutation({
  args: { amenityId: v.string(), siteSlug: v.string(), enabled: v.boolean() },
  handler: async (ctx, { amenityId, siteSlug, enabled }) => {
    const admin = await requireAdmin(ctx);

    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
      .unique();
    if (!site) throw new Error(`Unknown site: ${siteSlug}`);

    const existing = await ctx.db
      .query("amenitySettings")
      .withIndex("by_amenity", (q) => q.eq("amenityId", amenityId))
      .unique();

    const current = new Set(existing?.siteDisabled ?? []);
    if (enabled) current.delete(siteSlug);
    else current.add(siteSlug);

    if (existing) {
      await ctx.db.patch(existing._id, {
        siteDisabled: [...current],
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("amenitySettings", {
        amenityId,
        // Preserve the default rather than forcing true: opting one site out
        // of a facet must not silently switch it on everywhere else.
        filterEnabled: defaultFilterEnabled(amenityId),
        siteDisabled: [...current],
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
    }
    return { amenityId, siteSlug, enabled };
  },
});

/** Reset an amenity to its built-in default (deletes the stored row). */
export const resetToDefault = mutation({
  args: { amenityId: v.string() },
  handler: async (ctx, { amenityId }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("amenitySettings")
      .withIndex("by_amenity", (q) => q.eq("amenityId", amenityId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { amenityId, reset: true };
  },
});

// ── Per-property page visibility [scott, 2026-09-16] ──
/**
 * Hide or show one amenity on one property's public page. Display only; it
 * never affects search matching.
 */
export const setAmenityHidden = mutation({
  args: {
    propertyId: v.id("properties"),
    amenityId: v.string(),
    hidden: v.boolean(),
  },
  handler: async (ctx, { propertyId, amenityId, hidden }) => {
    await requireAdmin(ctx);
    const prop = await ctx.db.get(propertyId);
    if (!prop) throw new Error("Property not found");

    const current = new Set(prop.hiddenAmenities ?? []);
    if (hidden) current.add(amenityId);
    else current.delete(amenityId);

    await ctx.db.patch(propertyId, {
      hiddenAmenities: [...current],
      updatedAt: Date.now(),
    });
    return { amenityId, hidden };
  },
});

/** The amenity rows for one property's admin editor. */
export const listForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireAdmin(ctx);
    const prop = await ctx.db.get(propertyId);
    if (!prop) return [];

    const hidden = new Set(prop.hiddenAmenities ?? []);
    return (prop.amenityTags ?? [])
      .map((tag) => ({
        amenityId: rawTagId(tag),
        label: amenityLabelFor(rawTagId(tag)),
        raw: tag,
        hidden: hidden.has(rawTagId(tag)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },
});
