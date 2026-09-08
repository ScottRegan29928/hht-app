import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Owner-to-owner marketplace for the Swallowtail + Spicebush joint pool.
 *
 * Rules that came from Scott and must not drift:
 *  - Listings cross-populate: a Swallowtail listing shows in Spicebush and
 *    vice versa. Always query by `pool`, never by the origin site.
 *  - The owner sets their own price. There is no broker approval step.
 *  - There is NO under-contract lock — a listing stays visible until closed.
 *  - Trades are one-time swaps, not permanent, and are finalized off-platform
 *    on a signed form with a $75 fee. We surface, we do not execute.
 *  - Nothing here ever touches HostAway.
 *
 * Every read is gated server-side. The old WordPress Spicebush portal only
 * hid its owner table with CSS and leaked 34 owner emails to plain curl; the
 * gate below is the fix, so do not add an ungated listing query.
 */

export const JOINT_POOL = "seapines-joint";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type ViewerProfile = Doc<"userProfiles">;

/**
 * Resolve the signed-in owner. Mirrors owner.ts:requireOwner — owners may have
 * been pre-registered by email before they ever created a password.
 */
async function requireOwnerProfile(ctx: any): Promise<ViewerProfile> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile || profile.role !== "owner") {
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      const byEmail = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
      if (byEmail && byEmail.role === "owner") profile = byEmail;
    }
  }

  if (!profile || profile.role !== "owner") {
    throw new Error("Owner access required");
  }
  return profile as ViewerProfile;
}

/** Admins may read and moderate the marketplace from /management. */
async function requireAdminProfile(ctx: any): Promise<ViewerProfile> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  const adminRoles = ["admin", "admin_user", "admin_sales", "admin_rental"];
  if (!profile || !adminRoles.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile as ViewerProfile;
}

/** A listing is only live if it is active AND has not aged out. */
function isLive(l: Doc<"marketplaceListings">, now: number): boolean {
  return l.status === "active" && l.expiresAt > now;
}

// ────────────────────────────────────────────────────────────
// Owner-facing reads (gated)
// ────────────────────────────────────────────────────────────

/**
 * Browse the joint pool. Gated: throws unless the caller is a signed-in owner.
 * Returns listings from BOTH Sea Pines communities regardless of which site
 * the request came from — that is the point of the joint pool.
 */
export const listPool = query({
  args: {
    kind: v.optional(
      v.union(
        v.literal("for_sale"),
        v.literal("want_to_buy"),
        v.literal("trade")
      )
    ),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwnerProfile(ctx);
    const now = Date.now();

    const all = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_pool_status", (q) => q.eq("pool", JOINT_POOL))
      .collect();

    return all
      .filter((l) => (args.includeInactive ? true : isLive(l, now)))
      .filter((l) => (args.kind ? l.kind === args.kind : true))
      .sort((a, b) => b.postedAt - a.postedAt);
  },
});

/** Counts per kind, for the portal nav badges. */
export const poolCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireOwnerProfile(ctx);
    const now = Date.now();
    const all = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_pool_status", (q) => q.eq("pool", JOINT_POOL))
      .collect();
    const live = all.filter((l) => isLive(l, now));
    return {
      for_sale: live.filter((l) => l.kind === "for_sale").length,
      want_to_buy: live.filter((l) => l.kind === "want_to_buy").length,
      trade: live.filter((l) => l.kind === "trade").length,
      total: live.length,
    };
  },
});

/** The signed-in owner's own listings, including expired and closed ones. */
export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireOwnerProfile(ctx);
    const mine = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();
    return mine.sort((a, b) => b.postedAt - a.postedAt);
  },
});

// ────────────────────────────────────────────────────────────
// Owner-facing writes
// ────────────────────────────────────────────────────────────

export const createListing = mutation({
  args: {
    originSiteSlug: v.string(),
    kind: v.union(
      v.literal("for_sale"),
      v.literal("want_to_buy"),
      v.literal("trade")
    ),
    communitySlug: v.optional(v.string()),
    unitNumber: v.optional(v.string()),
    weekLabel: v.optional(v.string()),
    weekNumber: v.optional(v.number()),
    year: v.optional(v.number()),
    askingPrice: v.optional(v.number()),
    desiredWeekLabel: v.optional(v.string()),
    desiredWeekNumber: v.optional(v.number()),
    desiredYear: v.optional(v.number()),
    notes: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  returns: v.id("marketplaceListings"),
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const now = Date.now();

    if (args.askingPrice !== undefined && args.askingPrice < 0) {
      throw new Error("Asking price cannot be negative");
    }

    const contactName =
      args.contactName ??
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ??
      profile.displayName;

    return await ctx.db.insert("marketplaceListings", {
      pool: JOINT_POOL,
      originSiteSlug: args.originSiteSlug,
      kind: args.kind,
      status: "active",
      ownerProfileId: profile._id,
      isLegacy: false,
      communitySlug: args.communitySlug,
      unitNumber: args.unitNumber,
      weekLabel: args.weekLabel,
      weekNumber: args.weekNumber,
      year: args.year,
      askingPrice: args.askingPrice,
      desiredWeekLabel: args.desiredWeekLabel,
      desiredWeekNumber: args.desiredWeekNumber,
      desiredYear: args.desiredYear,
      notes: args.notes,
      contactName: contactName || undefined,
      contactEmail: args.contactEmail ?? profile.email,
      contactPhone: args.contactPhone ?? profile.phone,
      postedAt: now,
      expiresAt: now + ONE_YEAR_MS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Owner edits their own listing. Price is theirs to set; no approval step. */
export const updateListing = mutation({
  args: {
    listingId: v.id("marketplaceListings"),
    weekLabel: v.optional(v.string()),
    askingPrice: v.optional(v.number()),
    desiredWeekLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.ownerProfileId !== profile._id) {
      throw new Error("You can only edit your own listings");
    }
    const { listingId, ...patch } = args;
    const clean: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(listingId, clean);
    return null;
  },
});

/**
 * Change a listing's status. "closed" means the deal is done; until then the
 * listing stays visible — there is deliberately no under-contract state.
 * Re-listing an expired or withdrawn entry restarts its one-year clock.
 */
export const setListingStatus = mutation({
  args: {
    listingId: v.id("marketplaceListings"),
    status: v.union(
      v.literal("active"),
      v.literal("closed"),
      v.literal("withdrawn")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.ownerProfileId !== profile._id) {
      throw new Error("You can only change your own listings");
    }
    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.status === "closed") patch.closedAt = now;
    if (args.status === "active") {
      patch.postedAt = now;
      patch.expiresAt = now + ONE_YEAR_MS;
      patch.closedAt = undefined;
    }
    await ctx.db.patch(args.listingId, patch);
    return null;
  },
});

// ────────────────────────────────────────────────────────────
// Admin (/management)
// ────────────────────────────────────────────────────────────

export const adminListAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminProfile(ctx);
    const all = await ctx.db.query("marketplaceListings").collect();
    return all.sort((a, b) => b.postedAt - a.postedAt);
  },
});

/**
 * Admin moderation, including attaching a legacy row to a real owner account
 * once that owner registers.
 */
export const adminUpdateListing = mutation({
  args: {
    listingId: v.id("marketplaceListings"),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("closed"),
        v.literal("withdrawn"),
        v.literal("expired")
      )
    ),
    ownerProfileId: v.optional(v.id("userProfiles")),
    notes: v.optional(v.string()),
    askingPrice: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    const { listingId, ...patch } = args;
    const clean: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) clean[k] = val;
    }
    if (args.status === "active") {
      clean.postedAt = Date.now();
      clean.expiresAt = Date.now() + ONE_YEAR_MS;
    }
    await ctx.db.patch(listingId, clean);
    return null;
  },
});

// ────────────────────────────────────────────────────────────
// Maintenance
// ────────────────────────────────────────────────────────────

/**
 * Flip aged-out active listings to "expired". Reads already hide them via
 * isLive(), so this is bookkeeping that keeps the admin view honest rather
 * than a correctness guard.
 */
export const expireStaleListings = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({ expired: v.number(), dryRun: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const active = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const stale = active.filter((l) => l.expiresAt <= now);
    if (!args.dryRun) {
      for (const l of stale) {
        await ctx.db.patch(l._id, { status: "expired", updatedAt: now });
      }
    }
    return { expired: stale.length, dryRun: !!args.dryRun };
  },
});

/**
 * One-time import of the live WordPress owner tables. Idempotent on
 * (kind, unitNumber, weekLabel, contactEmail) so a re-run cannot double up.
 */
export const seedLegacyListings = internalMutation({
  args: {
    rows: v.array(
      v.object({
        kind: v.union(
          v.literal("for_sale"),
          v.literal("want_to_buy"),
          v.literal("trade")
        ),
        originSiteSlug: v.string(),
        communitySlug: v.optional(v.string()),
        unitNumber: v.optional(v.string()),
        weekLabel: v.optional(v.string()),
        weekNumber: v.optional(v.number()),
        askingPrice: v.optional(v.number()),
        desiredWeekLabel: v.optional(v.string()),
        notes: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        postedAt: v.number(),
      })
    ),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    inserted: v.number(),
    skipped: v.number(),
    dryRun: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("marketplaceListings").collect();
    const key = (r: {
      kind: string;
      unitNumber?: string;
      weekLabel?: string;
      contactEmail?: string;
    }) =>
      [r.kind, r.unitNumber ?? "", r.weekLabel ?? "", r.contactEmail ?? ""]
        .join("|")
        .toLowerCase();
    const seen = new Set(existing.map(key));

    let inserted = 0;
    let skipped = 0;
    const now = Date.now();

    for (const r of args.rows) {
      if (seen.has(key(r))) {
        skipped++;
        continue;
      }
      seen.add(key(r));
      inserted++;
      if (args.dryRun) continue;
      await ctx.db.insert("marketplaceListings", {
        pool: JOINT_POOL,
        originSiteSlug: r.originSiteSlug,
        kind: r.kind,
        status: "active",
        isLegacy: true,
        communitySlug: r.communitySlug,
        unitNumber: r.unitNumber,
        weekLabel: r.weekLabel,
        weekNumber: r.weekNumber,
        askingPrice: r.askingPrice,
        desiredWeekLabel: r.desiredWeekLabel,
        notes: r.notes,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone,
        postedAt: r.postedAt,
        expiresAt: r.postedAt + ONE_YEAR_MS,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { inserted, skipped, dryRun: !!args.dryRun };
  },
});
