import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Top-of-page notices for the owner portal, managed per community in the
 * admin portal [scott, 2026-09-13].
 *
 * Scoped by `siteSlug`, which is one-to-one with a community for the two
 * owner-portal resorts (spicebush / swallowtail), so a Spicebush notice never
 * appears to a Swallowtail owner.
 */

const TONES = ["info", "alert", "success"] as const;

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

function isLive(n: any, now: number) {
  if (!n.enabled) return false;
  if (n.startsAt && now < n.startsAt) return false;
  if (n.endsAt && now > n.endsAt) return false;
  return true;
}

const bySort = (a: any, b: any) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt - b.createdAt;

/** Notices an owner should currently see for this resort. */
export const listActive = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("ownerPortalNotices")
      .withIndex("by_site", (q: any) => q.eq("siteSlug", siteSlug))
      .collect();
    return rows.filter((n: any) => isLive(n, now)).sort(bySort);
  },
});

/** Every notice for a resort, live or not — admin view. */
export const adminList = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("ownerPortalNotices")
      .withIndex("by_site", (q: any) => q.eq("siteSlug", siteSlug))
      .collect();
    return rows
      .sort(bySort)
      .map((n: any) => ({ ...n, isLive: isLive(n, now) }));
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("ownerPortalNotices")),
    siteSlug: v.string(),
    message: v.string(),
    linkLabel: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    tone: v.optional(v.string()),
    enabled: v.boolean(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const message = args.message.trim();
    if (!message) throw new Error("A notice needs a message");
    if (args.linkUrl && !args.linkLabel?.trim()) {
      throw new Error("Give the link a label, or remove the link");
    }
    if (args.linkLabel?.trim() && !args.linkUrl?.trim()) {
      throw new Error("Give the link a URL, or remove the label");
    }
    if (args.startsAt && args.endsAt && args.endsAt < args.startsAt) {
      throw new Error("The end date is before the start date");
    }
    const tone =
      args.tone && (TONES as readonly string[]).includes(args.tone)
        ? args.tone
        : "info";

    const fields = {
      siteSlug: args.siteSlug,
      message,
      linkLabel: args.linkLabel?.trim() || undefined,
      linkUrl: args.linkUrl?.trim() || undefined,
      tone,
      enabled: args.enabled,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      sortOrder: args.sortOrder ?? 0,
      updatedAt: Date.now(),
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("That notice no longer exists");
      await ctx.db.patch(args.id, fields);
      return args.id;
    }
    return await ctx.db.insert("ownerPortalNotices", {
      ...fields,
      createdAt: Date.now(),
    });
  },
});

export const setEnabled = mutation({
  args: { id: v.id("ownerPortalNotices"), enabled: v.boolean() },
  handler: async (ctx, { id, enabled }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("That notice no longer exists");
    await ctx.db.patch(id, { enabled, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("ownerPortalNotices") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});
