import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Owner-portal content: documents, board roster and the per-resort copy blocks
 * that make up the legacy WordPress /owners/ pages.
 *
 * Parity source: the live Swallowtail and Spicebush /owners/ pages, inventoried
 * 2026-09-11 (see skills/hht_website/references/owner-portal-parity.md).
 *
 * Two rules to preserve:
 *  - Reads are gated to signed-in owners (and admins). The old Spicebush portal
 *    only hid its owner tables with CSS and leaked owner emails to plain curl.
 *    Association documents, minutes and the board roster carry owner emails and
 *    unit numbers, so they stay behind the same gate.
 *  - This content is DATA, never hardcoded copy. The Club Group maintains the
 *    roster, the newsletters and the seasonal voting banner without us.
 */

type Profile = Doc<"userProfiles">;

const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];

/** Signed-in owner, or an admin previewing a resort's portal. */
async function requirePortalViewer(ctx: any): Promise<Profile> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  // Owners are pre-registered by email, so a freshly activated account may not
  // be linked by userId yet.
  if (!profile) {
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
    }
  }

  if (!profile) throw new Error("Owner access required");
  if (profile.role !== "owner" && !ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Owner access required");
  }
  return profile as Profile;
}

async function requireAdmin(ctx: any): Promise<Profile> {
  const profile = await requirePortalViewer(ctx);
  if (!ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

// ── Documents ──────────────────────────────────────────────────────────────

const CATEGORY = v.union(
  v.literal("association"),
  v.literal("newsletter"),
  v.literal("minutes"),
  v.literal("stay"),
  v.literal("form")
);

async function withUrls(ctx: any, docs: Doc<"ownerDocuments">[]) {
  return await Promise.all(
    docs.map(async (d) => ({
      _id: d._id,
      title: d.title,
      category: d.category,
      documentDate: d.documentDate,
      sortOrder: d.sortOrder,
      published: d.published,
      url: d.storageId
        ? await ctx.storage.getUrl(d.storageId)
        : (d.externalUrl ?? null),
      mirrored: !!d.storageId,
    }))
  );
}

/** Newest first within a category; an explicit sortOrder wins. */
/**
 * Documents the two resorts both publish, in the order they should appear.
 *
 * Ordering used to fall back to each document's date, which is a property of
 * when the resort last revised its PDF — so the same four "arriving and
 * staying" links came out in a different order at Spicebush and Swallowtail
 * [scott, 2026-09-13]. Owners in both resorts see both portals, so the order
 * has to be a property of the document, not of its revision date.
 *
 * Matched loosely on the title: the two resorts name these slightly
 * differently and the list should survive a rename.
 */
const DOC_ORDER: RegExp[] = [
  /resort calendar/i,
  /checking in|check-in|directions/i,
  /late.?arrival/i,
  /outdoor activit/i,
  /master deed|bylaw/i,
  /site plan/i,
  /floor plan/i,
  /hoa (weeks|resale)/i,
  /board of directors list/i,
];

function docRank(title: string) {
  const i = DOC_ORDER.findIndex((re) => re.test(title));
  // Anything unrecognised sorts after the known set, by date, as before.
  return i === -1 ? DOC_ORDER.length : i;
}

function orderDocs(docs: Doc<"ownerDocuments">[]) {
  return [...docs].sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;

    const ar = docRank(a.title);
    const br = docRank(b.title);
    if (ar !== br) return ar - br;

    const ad = a.documentDate ?? 0;
    const bd = b.documentDate ?? 0;
    if (ad !== bd) return bd - ad;
    return a.title.localeCompare(b.title);
  });
}

export const listDocuments = query({
  args: { siteSlug: v.string(), category: v.optional(CATEGORY) },
  handler: async (ctx, { siteSlug, category }) => {
    await requirePortalViewer(ctx);
    const rows = category
      ? await ctx.db
          .query("ownerDocuments")
          .withIndex("by_site_category", (q) =>
            q.eq("siteSlug", siteSlug).eq("category", category)
          )
          .collect()
      : await ctx.db
          .query("ownerDocuments")
          .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
          .collect();
    return await withUrls(ctx, orderDocs(rows.filter((r) => r.published)));
  },
});

// ── Board of directors ─────────────────────────────────────────────────────

export const listBoard = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    await requirePortalViewer(ctx);
    const rows = await ctx.db
      .query("boardMembers")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .collect();
    return rows
      .filter((r) => r.published)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

// ── Per-resort settings ────────────────────────────────────────────────────

export const getSettings = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    await requirePortalViewer(ctx);
    return await ctx.db
      .query("ownerPortalSettings")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .first();
  },
});

/**
 * One call for the whole portal home screen. Saves the client from firing six
 * gated queries that each repeat the same auth lookup.
 */
/**
 * Which resorts this owner may read association content for.
 *
 * Ownership is not scoped to a portal — an owner can hold weeks at both
 * Spicebush and Swallowtail, and signing into either portal already shows all
 * of their weeks. Association content is the exception: two associations, two
 * boards, two sets of bylaws, so it stays per-resort [scott, 2026-09-13]. This
 * is what lets such an owner switch between them without a second login.
 *
 * Always includes the portal they are signed into, so a single-resort owner
 * sees exactly one entry and no switcher appears.
 */
export const myResorts = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const viewer = await requirePortalViewer(ctx);

    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", viewer._id))
      .collect();

    const slugs = new Set<string>([siteSlug]);
    for (const w of weeks) {
      const property: any = await ctx.db.get(w.propertyId);
      const community: any = property?.communityId
        ? await ctx.db.get(property.communityId)
        : null;
      // Only the two resorts that have portals. A week in Racquet Club or
      // Plantation Club carries no association portal of its own.
      if (community?.slug === "spicebush") slugs.add("spicebush");
      if (community?.slug === "swallowtail-at-sea-pines") slugs.add("swallowtail");
    }

    const sites = await ctx.db.query("sites").collect();
    return [...slugs].map((slug) => ({
      siteSlug: slug,
      name:
        sites.find((s: any) => s.slug === slug)?.name ??
        (slug === "swallowtail" ? "Swallowtail" : "Spicebush"),
    }));
  },
});

export const overview = query({
  args: { siteSlug: v.string(), portalSlug: v.optional(v.string()) },
  handler: async (ctx, { siteSlug, portalSlug }) => {
    const viewer = await requirePortalViewer(ctx);

    // Reading another resort's association content requires owning a week
    // there. The switcher only offers permitted resorts, but the check has to
    // live here — the argument comes from the client.
    if (portalSlug && siteSlug !== portalSlug) {
      const weeks = await ctx.db
        .query("weeks")
        .withIndex("by_owner", (q: any) => q.eq("ownerId", viewer._id))
        .collect();
      let allowed = false;
      for (const w of weeks) {
        const property: any = await ctx.db.get(w.propertyId);
        const community: any = property?.communityId
          ? await ctx.db.get(property.communityId)
          : null;
        const slug =
          community?.slug === "swallowtail-at-sea-pines"
            ? "swallowtail"
            : community?.slug;
        if (slug === siteSlug) {
          allowed = true;
          break;
        }
      }
      if (!allowed) throw new Error("You do not own a week at that resort");
    }
    const [docs, board, settings] = await Promise.all([
      ctx.db
        .query("ownerDocuments")
        .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
        .collect(),
      ctx.db
        .query("boardMembers")
        .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
        .collect(),
      ctx.db
        .query("ownerPortalSettings")
        .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
        .first(),
    ]);

    const published = orderDocs(docs.filter((d) => d.published));
    const byCategory: Record<string, any[]> = {};
    for (const d of await withUrls(ctx, published)) {
      (byCategory[d.category] ??= []).push(d);
    }

    return {
      viewerName: viewer.displayName ?? viewer.firstName ?? null,
      documents: byCategory,
      documentCount: published.length,
      board: board
        .filter((b) => b.published)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      settings,
    };
  },
});

// ── Admin maintenance ──────────────────────────────────────────────────────

export const adminListDocuments = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("ownerDocuments")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .collect();
    return await withUrls(ctx, orderDocs(rows));
  },
});

export const upsertDocument = mutation({
  args: {
    id: v.optional(v.id("ownerDocuments")),
    siteSlug: v.string(),
    category: CATEGORY,
    title: v.string(),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    documentDate: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("A document needs a title");
    if (!args.id && !args.storageId && !args.externalUrl) {
      throw new Error("Upload a file or provide a link");
    }
    const now = Date.now();
    if (args.id) {
      const { id, ...rest } = args;
      await ctx.db.patch(id, { ...rest, title, updatedAt: now });
      return id;
    }
    return await ctx.db.insert("ownerDocuments", {
      siteSlug: args.siteSlug,
      category: args.category,
      title,
      storageId: args.storageId,
      externalUrl: args.externalUrl,
      documentDate: args.documentDate,
      sortOrder: args.sortOrder,
      published: args.published ?? true,
      createdAt: now,
    });
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("ownerDocuments") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(id);
    if (doc?.storageId) await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(id);
  },
});

export const adminListBoard = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("boardMembers")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .collect();
    return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

export const upsertBoardMember = mutation({
  args: {
    id: v.optional(v.id("boardMembers")),
    siteSlug: v.string(),
    name: v.string(),
    title: v.optional(v.string()),
    holdings: v.optional(v.string()),
    termStart: v.optional(v.number()),
    termEnd: v.optional(v.number()),
    termNote: v.optional(v.string()),
    email: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("A board member needs a name");
    const now = Date.now();
    if (args.id) {
      const { id, ...rest } = args;
      await ctx.db.patch(id, { ...rest, name, updatedAt: now });
      return id;
    }
    return await ctx.db.insert("boardMembers", {
      ...args,
      name,
      published: args.published ?? true,
      createdAt: now,
    });
  },
});

export const deleteBoardMember = mutation({
  args: { id: v.id("boardMembers") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});

export const adminGetSettings = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("ownerPortalSettings")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .first();
  },
});

export const saveSettings = mutation({
  args: {
    siteSlug: v.string(),
    votingEnabled: v.boolean(),
    votingLabel: v.optional(v.string()),
    votingUrl: v.optional(v.string()),
    rentContactName: v.optional(v.string()),
    rentContactPhones: v.optional(v.array(v.string())),
    rentIntro: v.optional(v.string()),
    hoaSalesIntro: v.optional(v.string()),
    hoaSalesContactName: v.optional(v.string()),
    hoaSalesContactPhone: v.optional(v.string()),
    hoaSalesContactEmail: v.optional(v.string()),
    regimeManagers: v.optional(
      v.array(v.object({ name: v.string(), email: v.optional(v.string()) }))
    ),
    regimePhone: v.optional(v.string()),
    regimeFax: v.optional(v.string()),
    regimeEmail: v.optional(v.string()),
    commentCardIntro: v.optional(v.string()),
    weatherIntro: v.optional(v.string()),
    weatherLinks: v.optional(
      v.array(v.object({ label: v.string(), url: v.string() }))
    ),
    tradeFeeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.votingEnabled && !args.votingUrl?.trim()) {
      throw new Error("A voting banner needs a link");
    }
    const existing = await ctx.db
      .query("ownerPortalSettings")
      .withIndex("by_site", (q) => q.eq("siteSlug", args.siteSlug))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("ownerPortalSettings", {
      ...args,
      createdAt: now,
    });
  },
});
