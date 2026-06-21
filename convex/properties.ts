import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ── Public Queries ──

export const list = query({
  args: {
    communityId: v.optional(v.id("communities")),
    onlyActive: v.optional(v.boolean()),
    onlyFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, { communityId, onlyActive = true, onlyFeatured }) => {
    let q;
    if (communityId) {
      q = ctx.db
        .query("properties")
        .withIndex("by_community", (idx) => idx.eq("communityId", communityId));
    } else {
      q = ctx.db.query("properties");
    }

    let properties = await q.collect();

    if (onlyActive) {
      properties = properties.filter((p) => p.isActive);
    }
    if (onlyFeatured) {
      properties = properties.filter((p) => p.isFeatured);
    }

    // Resolve community names and primary photos
    return Promise.all(
      properties.map(async (p) => {
        const community = await ctx.db.get(p.communityId);
        // Get primary photo
        const primaryPhoto = await ctx.db
          .query("propertyPhotos")
          .withIndex("by_primary", (idx) =>
            idx.eq("propertyId", p._id).eq("isPrimary", true)
          )
          .first();
        let photoUrl: string | null = null;
        if (primaryPhoto?.storageId) {
          photoUrl = await ctx.storage.getUrl(primaryPhoto.storageId);
        } else if (primaryPhoto?.externalUrl) {
          photoUrl = primaryPhoto.externalUrl;
        } else if (p.photoUrls && p.photoUrls.length > 0) {
          photoUrl = p.photoUrls[0];
        }

        return {
          ...p,
          communityName: community?.name ?? "Unknown",
          communitySlug: community?.slug ?? "",
          photoUrl,
        };
      })
    );
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const property = await ctx.db
      .query("properties")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!property) return null;

    const community = await ctx.db.get(property.communityId);

    // Get all photos
    const photos = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();
    const photoUrls = await Promise.all(
      photos
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (p) => {
          if (p.storageId) {
            return await ctx.storage.getUrl(p.storageId);
          }
          return p.externalUrl ?? null;
        })
    );

    // Get available weeks
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();

    return {
      ...property,
      communityName: community?.name ?? "Unknown",
      communitySlug: community?.slug ?? "",
      photos: photoUrls.filter(Boolean) as string[],
      weeks: weeks
        .filter((w) => w.status === "available")
        .sort((a, b) => a.weekNumber - b.weekNumber),
    };
  },
});

export const search = query({
  args: {
    communityId: v.optional(v.id("communities")),
    weekNumber: v.optional(v.number()),
    minBedrooms: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
  },
  handler: async (ctx, { communityId, weekNumber, minBedrooms, maxPrice }) => {
    // Start with all active properties
    let properties;
    if (communityId) {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_community", (q) => q.eq("communityId", communityId))
        .collect();
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }

    properties = properties.filter((p) => p.isActive);

    if (minBedrooms) {
      properties = properties.filter((p) => p.bedrooms >= minBedrooms);
    }

    // If filtering by week or price, check weeks table
    if (weekNumber || maxPrice) {
      const filtered = [];
      for (const p of properties) {
        const weeks = await ctx.db
          .query("weeks")
          .withIndex("by_property", (q) => q.eq("propertyId", p._id))
          .collect();
        const availableWeeks = weeks.filter((w) => w.status === "available");

        let matchingWeeks = availableWeeks;
        if (weekNumber) {
          matchingWeeks = matchingWeeks.filter(
            (w) => w.weekNumber === weekNumber
          );
        }
        if (maxPrice) {
          matchingWeeks = matchingWeeks.filter(
            (w) => w.price && w.price <= maxPrice
          );
        }
        if (matchingWeeks.length > 0) {
          filtered.push(p);
        }
      }
      properties = filtered;
    }

    // Resolve community names and primary photos
    return Promise.all(
      properties.map(async (p) => {
        const community = await ctx.db.get(p.communityId);
        let photoUrl: string | null = null;
        if (p.photoUrls && p.photoUrls.length > 0) {
          photoUrl = p.photoUrls[0];
        }
        return {
          ...p,
          communityName: community?.name ?? "Unknown",
          communitySlug: community?.slug ?? "",
          photoUrl,
        };
      })
    );
  },
});

// ── Admin Mutations ──

export const seed = mutation({
  args: {
    address: v.string(),
    slug: v.string(),
    unitNumber: v.string(),
    communityId: v.id("communities"),
    bedrooms: v.number(),
    bathrooms: v.number(),
    sleeps: v.optional(v.number()),
    description: v.optional(v.string()),
    amenityTags: v.optional(v.array(v.string())),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    photoUrls: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    isFeatured: v.optional(v.boolean()),
    wpPageId: v.optional(v.number()),
    wpSlug: v.optional(v.string()),
    houseRules: v.optional(v.string()),
    cancellationPolicy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("properties")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("properties", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
