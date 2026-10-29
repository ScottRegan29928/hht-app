import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getToken, getWithRetry } from "./hostawayApi";
import { reviewVisible, publicReview } from "./reviewPolicy";

async function requireRentalAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db.query("userProfiles").withIndex("by_userId", (q: any) => q.eq("userId", userId)).first();
  if (!profile || !["admin", "admin_user", "admin_rental"].includes(profile.role)) throw new Error("Rental admin access required");
  return profile;
}
export const authorize = internalQuery({
  args: {}, returns: v.any(),
  handler: async (ctx): Promise<any> => { await requireRentalAdmin(ctx); return true; },
});
export const forProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const property = await ctx.db.get(propertyId);
    if (!property || property.isActive === false) return [];
    return (await ctx.db.query("guestReviews").withIndex("by_property", q => q.eq("propertyId", propertyId)).collect())
      .filter(r => r.upstreamVisible && !r.hiddenOnSite)
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).map(publicReview);
  },
});
export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireRentalAdmin(ctx);
    const properties = await ctx.db.query("properties").collect();
    const names = new Map(properties.map(p => [p._id, p.address]));
    return (await ctx.db.query("guestReviews").collect()).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
      .map(r => ({ ...r, propertyName: names.get(r.propertyId) ?? "Property" }));
  },
});
export const saveResponse = mutation({
  args: { reviewId: v.id("guestReviews"), body: v.string() },
  handler: async (ctx, { reviewId, body }) => {
    const profile = await requireRentalAdmin(ctx);
    if (body.length > 5000) throw new Error("Response must be 5,000 characters or fewer");
    const review = await ctx.db.get(reviewId);
    if (!review) throw new Error("Review not found");
    const text = body.trim();
    await ctx.db.insert("reviewResponseHistory", {
      reviewId, body: text, authorProfileId: profile._id, createdAt: Date.now(),
    });
    await ctx.db.patch(reviewId, { response: text || undefined, responseUpdatedAt: Date.now() });
  },
});
export const setHidden = mutation({
  args: { reviewId: v.id("guestReviews"), hidden: v.boolean() },
  handler: async (ctx, { reviewId, hidden }) => {
    await requireRentalAdmin(ctx);
    if (!await ctx.db.get(reviewId)) throw new Error("Review not found");
    await ctx.db.patch(reviewId, { hiddenOnSite: hidden });
  },
});
export const importBatch = internalMutation({
  args: { rows: v.array(v.any()), syncedAt: v.number() }, returns: v.any(),
  handler: async (ctx, { rows, syncedAt }): Promise<any> => {
    const properties = await ctx.db.query("properties").collect();
    const byHostaway = new Map(properties.filter(p => p.hostawayId).map(p => [p.hostawayId, p._id]));
    let imported = 0;
    for (const row of rows) {
      if (row.type !== "guest-to-host") continue;
      const propertyId = byHostaway.get(Number(row.listingMapId));
      if (!propertyId || !Number.isFinite(Number(row.id))) continue;
      const existing = await ctx.db.query("guestReviews").withIndex("by_hostaway", q => q.eq("hostawayReviewId", Number(row.id))).unique();
      // Preserve moderation decisions and locally written management responses.
      const doc = { hostawayReviewId: Number(row.id), propertyId,
        guestFirstName: String(row.reviewerName ?? row.guestName ?? "Guest").trim().split(/\s+/)[0] || "Guest",
        body: String(row.publicReview ?? "").trim(),
        reviewedAt: String(row.submittedAt ?? row.updatedOn ?? row.insertedOn ?? "").slice(0, 10),
        upstreamVisible: reviewVisible(row), syncedAt };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("guestReviews", { ...doc, hiddenOnSite: false });
      imported++;
    }
    return { imported };
  },
});
export const finishSync = internalMutation({
  args: { syncedAt: v.number() }, returns: v.null(),
  handler: async (ctx, { syncedAt }): Promise<null> => {
    // Only after every page succeeded: removed reviews must disappear too.
    for (const row of await ctx.db.query("guestReviews").collect()) {
      if (row.syncedAt < syncedAt) await ctx.db.patch(row._id, { upstreamVisible: false });
    }
    return null;
  },
});
export const sync = internalAction({
  args: {}, returns: v.any(),
  handler: async (ctx): Promise<any> => {
    const token = await getToken(ctx);
    const syncedAt = Date.now();
    let offset = 0, imported = 0;
    for (let page = 0; page < 100; page++) {
      const res = await getWithRetry(`https://api.hostaway.com/v1/reviews?limit=100&offset=${offset}`, token);
      if (!res.ok) throw new Error(`Review sync HTTP ${res.status}; existing reviews retained`);
      const data = await res.json();
      if (data.status !== "success" || !Array.isArray(data.result)) throw new Error("Invalid review response");
      const result: any = await ctx.runMutation(internal.guestReviews.importBatch, { rows: data.result, syncedAt });
      imported += result.imported;
      offset += data.result.length;
      if (!data.result.length || offset >= Number(data.count ?? Infinity)) {
        await ctx.runMutation(internal.guestReviews.finishSync, { syncedAt });
        return { fetched: offset, imported };
      }
    }
    throw new Error("Review pagination exceeded safety limit; existing reviews retained");
  },
});
export const refresh = action({
  args: {}, returns: v.any(),
  handler: async (ctx): Promise<any> => {
    await ctx.runQuery(internal.guestReviews.authorize, {});
    return await ctx.runAction(internal.guestReviews.sync, {});
  },
});
