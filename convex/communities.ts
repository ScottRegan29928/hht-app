import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ── Public Queries ──

export const list = query({
  args: {},
  handler: async (ctx) => {
    const communities = await ctx.db
      .query("communities")
      .withIndex("by_sortOrder")
      .collect();
    // Resolve hero images
    return Promise.all(
      communities.map(async (c) => ({
        ...c,
        heroImageUrl: c.heroImageId
          ? await ctx.storage.getUrl(c.heroImageId)
          : null,
      }))
    );
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const community = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!community) return null;

    const heroImageUrl = community.heroImageId
      ? await ctx.storage.getUrl(community.heroImageId)
      : null;

    // Get property count
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect();
    const activeCount = properties.filter((p) => p.isActive).length;

    // Get community documents
    const documents = await ctx.db
      .query("communityDocuments")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect();

    return {
      ...community,
      heroImageUrl,
      propertyCount: activeCount,
      documents,
    };
  },
});

// ── Admin Mutations ──

export const seed = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    latitude: v.number(),
    longitude: v.number(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("communities", {
      ...args,
      isActive: true,
    });
  },
});
