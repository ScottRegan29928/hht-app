import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { allowedCommunityIds } from "./sites";

// ── Public Queries ──

export const list = query({
  args: { siteSlug: v.optional(v.string()) },
  handler: async (ctx, { siteSlug }) => {
    let communities = await ctx.db
      .query("communities")
      .withIndex("by_sortOrder")
      .collect();
    // Site scoping (server-enforced): a scoped site only ever sees its own
    // communities, so nav, dropdowns and homepage grids can't leak a sister
    // site's inventory.
    const allowed = await allowedCommunityIds(ctx, siteSlug);
    if (allowed) {
      communities = communities.filter((c) => allowed.has(c._id as string));
    }
    // Resolve hero images and compute bed/bath ranges from properties
    return Promise.all(
      communities.map(async (c) => {
        const props = await ctx.db
          .query("properties")
          .withIndex("by_community", (q) => q.eq("communityId", c._id))
          .collect();
        const active = props.filter((p) => p.isActive);
        const beds = active.map((p) => p.bedrooms).sort((a, b) => a - b);
        const baths = active.map((p) => p.bathrooms).sort((a, b) => a - b);
        // Resolve hero image — fall back to first property's photo
        let heroImageUrl: string | null = c.heroImageId
          ? await ctx.storage.getUrl(c.heroImageId)
          : null;
        if (!heroImageUrl && active.length > 0) {
          // Try propertyPhotos table first, then photoUrls field
          for (const prop of active) {
            const photo = await ctx.db
              .query("propertyPhotos")
              .withIndex("by_property", (q) => q.eq("propertyId", prop._id))
              .first();
            if (photo) {
              heroImageUrl = photo.url;
              break;
            }
            if (prop.photoUrls && prop.photoUrls.length > 0) {
              heroImageUrl = prop.photoUrls[0];
              break;
            }
          }
        }

        return {
          ...c,
          heroImageUrl,
          propertyCount: active.length,
          bedroomMin: beds.length > 0 ? beds[0] : null,
          bedroomMax: beds.length > 0 ? beds[beds.length - 1] : null,
          bathroomMin: baths.length > 0 ? baths[0] : null,
          bathroomMax: baths.length > 0 ? baths[baths.length - 1] : null,
        };
      })
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

export const updateName = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { slug, name }) => {
    const community = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!community) throw new Error(`Community not found: ${slug}`);
    await ctx.db.patch(community._id, { name });
  },
});

export const updateCoords = mutation({
  args: {
    slug: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, { slug, latitude, longitude }) => {
    const community = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!community) throw new Error(`Community not found: ${slug}`);
    await ctx.db.patch(community._id, { latitude, longitude });
  },
});
