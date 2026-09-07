import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Hostaway CSV Import Mutations ──

/**
 * Update a single property with Hostaway CSV data (new fields + descriptions).
 * Also updates coordinates, bedrooms, bathrooms, sleeps if provided.
 */
export const updatePropertyFromHostaway = mutation({
  args: {
    propertyId: v.id("properties"),
    // Core fields (update existing)
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    sleeps: v.optional(v.number()),
    description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    // New Hostaway fields
    nightlyRate: v.optional(v.number()),
    cleaningFee: v.optional(v.number()),
    weeklyDiscount: v.optional(v.number()),
    monthlyDiscount: v.optional(v.number()),
    maxNights: v.optional(v.number()),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    checkinType: v.optional(v.string()),
    bedsCount: v.optional(v.number()),
    bedTypes: v.optional(v.array(v.string())),
    roomType: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { propertyId, ...fields } = args;
    // Filter out undefined values
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
    }
    await ctx.db.patch(propertyId, patch);
    return { success: true };
  },
});

/**
 * Create a new property from Hostaway CSV data (for properties not in DB).
 */
export const createPropertyFromHostaway = mutation({
  args: {
    address: v.string(),
    slug: v.string(),
    unitNumber: v.string(),
    communityId: v.id("communities"),
    bedrooms: v.number(),
    bathrooms: v.number(),
    sleeps: v.optional(v.number()),
    description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    nightlyRate: v.optional(v.number()),
    cleaningFee: v.optional(v.number()),
    weeklyDiscount: v.optional(v.number()),
    monthlyDiscount: v.optional(v.number()),
    maxNights: v.optional(v.number()),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    checkinType: v.optional(v.string()),
    bedsCount: v.optional(v.number()),
    bedTypes: v.optional(v.array(v.string())),
    roomType: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("properties", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
    return { id };
  },
});

/**
 * Set all weeks for a property to available for rent at given weekly price.
 * Preserves existing sale prices by setting listingType to "both" if sale price exists.
 * Creates weeks 1-52 if they don't exist.
 */
export const setPropertyWeeksForRent = mutation({
  args: {
    propertyId: v.id("properties"),
    weeklyRentPrice: v.number(),
  },
  handler: async (ctx, { propertyId, weeklyRentPrice }) => {
    const existingWeeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect();

    const existingMap = new Map(existingWeeks.map((w) => [w.weekNumber, w]));
    let updated = 0;
    let created = 0;

    for (let wn = 1; wn <= 52; wn++) {
      const existing = existingMap.get(wn);
      if (existing) {
        // If week has a sale price, set to "both"; otherwise "rent"
        const listingType = existing.price ? "both" : "rent";
        await ctx.db.patch(existing._id, {
          rentPrice: weeklyRentPrice,
          listingType,
          status: existing.status === "not_listed" ? "available" : existing.status,
          year: 2026,
          updatedAt: Date.now(),
        });
        updated++;
      } else {
        await ctx.db.insert("weeks", {
          propertyId,
          weekNumber: wn,
          year: 2026,
          listingType: "rent",
          rentPrice: weeklyRentPrice,
          isAnnual: false,
          status: "available" as const,
          createdAt: Date.now(),
        });
        created++;
      }
    }

    return { updated, created };
  },
});

/**
 * Remove rental availability from all weeks of a property (not in Hostaway).
 * Weeks with sale prices → "sale" only. Others → "not_listed".
 */
export const removeRentalFromProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect();

    let updated = 0;
    for (const week of weeks) {
      const newType = week.price ? "sale" : undefined;
      const newStatus = week.price ? week.status : "not_listed";
      await ctx.db.patch(week._id, {
        listingType: newType as any,
        rentPrice: undefined,
        status: newStatus as any,
        updatedAt: Date.now(),
      });
      updated++;
    }
    return { updated };
  },
});


// ── Legacy migrations (kept for reference) ──

export const normalizeCommunityAmenities = mutation({
  args: {},
  handler: async (ctx) => {
    const NORMALIZE: Record<string, string> = {
      "Beach Access": "beach_access", "Bike Trails": "bike_trails",
      "Fitness Center": "fitness_center", "Golf": "golf",
      "Golf Course Views": "on_golf_course", "Harbour Town": "near_harbour_town",
      "Lagoon Views": "lagoon_views", "Marina": "marina",
      "Marina Access": "marina", "Marina Views": "marina",
      "Nature Center": "nature_trails", "Nature Trails": "nature_trails",
      "Playground": "playground", "Pool": "pool", "Shopping": "shopping",
      "South Beach": "near_beach_club", "Tennis": "tennis", "Tennis Courts": "tennis",
      "Water Views": "water_views",
    };
    const communities = await ctx.db.query("communities").collect();
    const results: string[] = [];
    for (const c of communities) {
      const existing = c.amenities ?? [];
      if (existing.length === 0) { results.push(`${c.name}: no amenities`); continue; }
      const normalized = new Set<string>();
      for (const a of existing) { normalized.add(NORMALIZE[a] ?? a); }
      const sorted = Array.from(normalized).sort();
      await ctx.db.patch(c._id, { amenities: sorted });
      results.push(`${c.name}: ${existing.join(", ")} → ${sorted.join(", ")}`);
    }
    return results;
  },
});

export const migrateFeaturesToCommunities = mutation({
  args: {},
  handler: async (ctx) => {
    const communities = await ctx.db.query("communities").collect();
    const properties = await ctx.db.query("properties").collect();
    const results: string[] = [];
    for (const comm of communities) {
      const commProps = properties.filter((p) => p.communityId === comm._id);
      const merged: Record<string, string> = {};
      for (const p of commProps) {
        if (p.featureCategories) {
          for (const [key, value] of Object.entries(p.featureCategories)) {
            if (value && typeof value === "string" && value.trim()) {
              if (merged[key]) {
                const existingItems = merged[key].split(", ").map((s) => s.trim());
                const newItems = value.split(", ").map((s) => s.trim());
                merged[key] = Array.from(new Set([...existingItems, ...newItems])).join(", ");
              } else { merged[key] = value; }
            }
          }
        }
      }
      if (Object.keys(merged).length > 0) {
        await ctx.db.patch(comm._id, { features: merged });
        results.push(`${comm.name}: ${Object.keys(merged).length} feature categories`);
      } else { results.push(`${comm.name}: no features to migrate`); }
    }
    return results;
  },
});

export const debugWeeks = query({
  args: {},
  handler: async (ctx) => {
    const weeks = await ctx.db.query("weeks").take(10);
    return weeks.map((w) => ({
      _id: w._id, weekNumber: w.weekNumber, status: w.status,
      listingType: (w as any).listingType, price: w.price,
      rentPrice: (w as any).rentPrice, propertyId: w.propertyId,
    }));
  },
});

export const deactivateProperty = mutation({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { isActive: false });
    return "deactivated";
  },
});
