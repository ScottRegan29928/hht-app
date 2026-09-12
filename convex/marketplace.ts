import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

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

/**
 * Every week number a free-text label refers to: "31 & 32" -> [31, 32].
 *
 * Owners type week labels by hand and real rows say "9, 10, 11, 12" or
 * "31 & 32". A single weekNumber cannot represent those, so filtering by week
 * would silently miss multi-week listings and so would match alerts. This is
 * derived server-side on every write so the array can never drift from the
 * label the owner sees.
 */
export function expandWeeks(label?: string | null): number[] {
  if (!label) return [];
  const found: number[] = [];
  for (const m of label.matchAll(/\d+/g)) {
    const n = Number(m[0]);
    if (n >= 1 && n <= 53 && !found.includes(n)) found.push(n);
  }
  return found.sort((a, b) => a - b);
}

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
    // Filters [scott, 2026-09-12]. Applied in memory: the pool is a few dozen
    // rows, and week matching needs the weekNumbers array rather than an index.
    communitySlug: v.optional(v.string()),
    weekNumber: v.optional(v.number()),
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
      .filter((l) =>
        args.communitySlug ? l.communitySlug === args.communitySlug : true
      )
      .filter((l) => {
        if (args.weekNumber === undefined) return true;
        const weeks = l.weekNumbers?.length
          ? l.weekNumbers
          : expandWeeks(l.weekLabel);
        // A want_to_buy/trade listing is also a match on the week it wants.
        const desired = l.desiredWeekNumbers?.length
          ? l.desiredWeekNumbers
          : expandWeeks(l.desiredWeekLabel);
        return (
          weeks.includes(args.weekNumber) || desired.includes(args.weekNumber)
        );
      })
      .sort((a, b) => b.postedAt - a.postedAt);
  },
});

/**
 * The communities and week numbers that actually appear in the pool, so the
 * filter controls only ever offer values that return something.
 */
export const poolFacets = query({
  args: {},
  handler: async (ctx) => {
    await requireOwnerProfile(ctx);
    const now = Date.now();
    const live = (
      await ctx.db
        .query("marketplaceListings")
        .withIndex("by_pool_status", (q) => q.eq("pool", JOINT_POOL))
        .collect()
    ).filter((l) => isLive(l, now));

    const communities = new Map<string, number>();
    const weeks = new Set<number>();
    for (const l of live) {
      if (l.communitySlug)
        communities.set(
          l.communitySlug,
          (communities.get(l.communitySlug) ?? 0) + 1
        );
      const ws = l.weekNumbers?.length ? l.weekNumbers : expandWeeks(l.weekLabel);
      const ds = l.desiredWeekNumbers?.length
        ? l.desiredWeekNumbers
        : expandWeeks(l.desiredWeekLabel);
      for (const w of [...ws, ...ds]) weeks.add(w);
    }
    return {
      communities: [...communities.entries()]
        .map(([slug, count]) => ({ slug, count }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
      weeks: [...weeks].sort((a, b) => a - b),
    };
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

/**
 * Normalized key for "the same unit/week". Owners must not be able to hold two
 * listings for one week [scott, 2026-09-08] — a repost updates the original
 * instead of stacking a second, contradictory entry beside it. This is the same
 * failure mode the WordPress table had, where one owner's unit 575 sat in the
 * list twice at two different prices.
 */
function weekKey(unitNumber?: string, weekLabel?: string): string | null {
  const u = (unitNumber ?? "").trim().toLowerCase();
  const w = (weekLabel ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!u || !w) return null;
  return `${u}::${w}`;
}

/**
 * An owner's prior listing for this unit/week, whatever its status. Closed and
 * expired entries match too, so reposting a week revives the original record
 * rather than leaving a duplicate history behind.
 */
async function findOwnerListingForWeek(
  ctx: MutationCtx,
  ownerProfileId: Id<"userProfiles">,
  unitNumber?: string,
  weekLabel?: string,
  excludeId?: Id<"marketplaceListings">
) {
  const key = weekKey(unitNumber, weekLabel);
  if (!key) return null;
  const mine = await ctx.db
    .query("marketplaceListings")
    .withIndex("by_owner", (q) => q.eq("ownerProfileId", ownerProfileId))
    .collect();
  for (const l of mine) {
    if (excludeId && l._id === excludeId) continue;
    if (weekKey(l.unitNumber, l.weekLabel) === key) return l;
  }
  return null;
}

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

    const existing = await findOwnerListingForWeek(
      ctx,
      profile._id,
      args.unitNumber,
      args.weekLabel
    );
    if (existing) {
      // Update in place and restart the one-year clock, rather than creating a
      // second listing for a week this owner already has listed.
      await ctx.db.patch(existing._id, {
        kind: args.kind,
        status: "active",
        originSiteSlug: args.originSiteSlug,
        communitySlug: args.communitySlug ?? existing.communitySlug,
        weekNumber: args.weekNumber ?? existing.weekNumber,
        weekNumbers: expandWeeks(args.weekLabel ?? existing.weekLabel),
        year: args.year ?? existing.year,
        askingPrice: args.askingPrice,
        desiredWeekLabel: args.desiredWeekLabel,
        desiredWeekNumber: args.desiredWeekNumber,
        desiredWeekNumbers: expandWeeks(args.desiredWeekLabel),
        desiredYear: args.desiredYear,
        notes: args.notes,
        contactName: contactName || existing.contactName,
        contactEmail: args.contactEmail ?? profile.email ?? existing.contactEmail,
        contactPhone: args.contactPhone ?? profile.phone ?? existing.contactPhone,
        isLegacy: false,
        postedAt: now,
        expiresAt: now + ONE_YEAR_MS,
        closedAt: undefined,
        updatedAt: now,
      });
      // Re-run matching: an edit can introduce a week nobody was told about.
      await ctx.scheduler.runAfter(
        0,
        internal.marketplaceMatches.runForListing,
        { listingId: existing._id }
      );
      return existing._id;
    }

    const listingId = await ctx.db.insert("marketplaceListings", {
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
      weekNumbers: expandWeeks(args.weekLabel),
      year: args.year,
      askingPrice: args.askingPrice,
      desiredWeekLabel: args.desiredWeekLabel,
      desiredWeekNumber: args.desiredWeekNumber,
      desiredWeekNumbers: expandWeeks(args.desiredWeekLabel),
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

    // Tell every owner who holds a week this listing is looking for.
    await ctx.scheduler.runAfter(0, internal.marketplaceMatches.runForListing, {
      listingId,
    });
    return listingId;
  },
});

/** Owner edits their own listing. Price is theirs to set; no approval step. */
export const updateListing = mutation({
  args: {
    listingId: v.id("marketplaceListings"),
    kind: v.optional(
      v.union(
        v.literal("for_sale"),
        v.literal("want_to_buy"),
        v.literal("trade")
      )
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
    clearPrice: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.ownerProfileId !== profile._id) {
      throw new Error("You can only edit your own listings");
    }
    if (args.askingPrice !== undefined && args.askingPrice < 0) {
      throw new Error("Asking price cannot be negative");
    }

    // Editing a listing onto a unit/week the owner already has listed would
    // recreate the duplicate this rule exists to prevent.
    const clash = await findOwnerListingForWeek(
      ctx,
      profile._id,
      args.unitNumber ?? listing.unitNumber,
      args.weekLabel ?? listing.weekLabel,
      listing._id
    );
    if (clash) {
      throw new Error(
        "You already have a listing for that unit and week. Edit that listing instead."
      );
    }

    const { listingId, clearPrice, ...patch } = args;
    const clean: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) clean[k] = val;
    }
    // "Contact for price" has to be reachable from a listing that once had a
    // number, so an explicit clear is distinct from an omitted field.
    if (clearPrice) clean.askingPrice = undefined;
    // Keep the derived week arrays in step with whatever label is now stored,
    // otherwise an edited listing keeps answering filters for its old weeks.
    if (args.weekLabel !== undefined)
      clean.weekNumbers = expandWeeks(args.weekLabel);
    if (args.desiredWeekLabel !== undefined)
      clean.desiredWeekNumbers = expandWeeks(args.desiredWeekLabel);
    await ctx.db.patch(listingId, clean);
    await ctx.scheduler.runAfter(0, internal.marketplaceMatches.runForListing, {
      listingId,
    });
    return null;
  },
});

/**
 * Remove a listing outright. Distinct from "withdrawn", which keeps the record
 * so the owner can repost it later; owners asked to be able to delete
 * [scott, 2026-09-08]. Legacy imported rows are deletable too — an owner who
 * never posted it themselves still owns the week.
 */
export const deleteListing = mutation({
  args: { listingId: v.id("marketplaceListings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) return null;
    if (listing.ownerProfileId !== profile._id) {
      throw new Error("You can only remove your own listings");
    }
    await ctx.db.delete(args.listingId);
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
        weekNumbers: v.optional(v.array(v.number())),
        desiredWeekNumbers: v.optional(v.array(v.number())),
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
        weekNumbers: r.weekNumbers ?? expandWeeks(r.weekLabel),
        desiredWeekNumbers:
          r.desiredWeekNumbers ?? expandWeeks(r.desiredWeekLabel),
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

/**
 * One-off: fill weekNumbers/desiredWeekNumbers on rows seeded before those
 * fields existed. Idempotent — safe to re-run after any future import.
 */
export const backfillWeekNumbers = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    const all = await ctx.db.query("marketplaceListings").collect();
    let updated = 0;
    for (const l of all) {
      const weeks = expandWeeks(l.weekLabel);
      const desired = expandWeeks(l.desiredWeekLabel);
      const same = (a?: number[], b?: number[]) =>
        JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
      if (same(l.weekNumbers, weeks) && same(l.desiredWeekNumbers, desired))
        continue;
      await ctx.db.patch(l._id, {
        weekNumbers: weeks,
        desiredWeekNumbers: desired,
      });
      updated++;
    }
    return { scanned: all.length, updated };
  },
});
