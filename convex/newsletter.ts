import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

/**
 * Newsletter signups from the site footer.
 *
 * Scoped per site — a Spicebush signup is not a Heritage signup — which
 * matches how contentPages and blogPosts behave, and is the opposite of the
 * owner marketplace, where cross-population is the whole point.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribe = mutation({
  args: { siteSlug: v.string(), email: v.string() },
  handler: async (ctx, { siteSlug, email }) => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) throw new Error("Please enter a valid email address.");

    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_site_email", (q) => q.eq("siteSlug", siteSlug).eq("email", clean))
      .first();

    // Re-subscribing is idempotent, and clears a previous unsubscribe rather
    // than stacking duplicate rows.
    if (existing) {
      if (existing.unsubscribedAt) {
        await ctx.db.patch(existing._id, { unsubscribedAt: undefined, createdAt: Date.now() });
      }
      return { ok: true, alreadySubscribed: !existing.unsubscribedAt };
    }

    await ctx.db.insert("newsletterSubscribers", {
      siteSlug,
      email: clean,
      createdAt: Date.now(),
    });
    return { ok: true, alreadySubscribed: false };
  },
});

export const adminList = query({
  args: { siteSlug: v.optional(v.string()) },
  handler: async (ctx, { siteSlug }) => {
    await requireAdmin(ctx);
    const rows = siteSlug
      ? await ctx.db
          .query("newsletterSubscribers")
          .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
          .collect()
      : await ctx.db.query("newsletterSubscribers").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const adminRemove = mutation({
  args: { id: v.id("newsletterSubscribers") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return { deleted: true };
  },
});
