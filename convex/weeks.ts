import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .collect();
    return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
  },
});

export const searchByWeek = query({
  args: { weekNumber: v.number() },
  handler: async (ctx, { weekNumber }) => {
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_week", (q) => q.eq("weekNumber", weekNumber))
      .collect();

    const available = weeks.filter((w) => w.status === "available");

    return Promise.all(
      available.map(async (w) => {
        const property = await ctx.db.get(w.propertyId);
        if (!property) return null;
        const community = await ctx.db.get(property.communityId);
        return {
          ...w,
          property: {
            _id: property._id,
            address: property.address,
            slug: property.slug,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
          },
          communityName: community?.name ?? "Unknown",
        };
      })
    );
  },
});

export const seed = mutation({
  args: {
    propertyId: v.id("properties"),
    weekNumber: v.number(),
    price: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("pending"),
      v.literal("sold"),
      v.literal("not_listed")
    ),
    isAnnual: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("weeks")
      .withIndex("by_property_week", (q) =>
        q.eq("propertyId", args.propertyId).eq("weekNumber", args.weekNumber)
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("weeks", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
