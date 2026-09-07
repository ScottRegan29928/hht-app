import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ── Query: get all properties with hostawayId for matching ──
export const getAllProperties = internalQuery({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query("properties").collect();
    return properties.map((p) => ({
      _id: p._id,
      hostawayId: (p as any).hostawayId as number | undefined,
      address: p.address,
      slug: p.slug,
      unitNumber: p.unitNumber,
      communityId: p.communityId,
    }));
  },
});

// ── Query: get all communities for slug lookup ──
export const getAllCommunities = internalQuery({
  args: {},
  handler: async (ctx) => {
    const communities = await ctx.db.query("communities").collect();
    return communities.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
    }));
  },
});

// ── Mutation: upsert a property from Hostaway data ──
export const upsertProperty = internalMutation({
  args: {
    existingId: v.optional(v.id("properties")),
    hostawayId: v.number(),
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
    nightlyRate: v.optional(v.number()),
    cleaningFee: v.optional(v.number()),
    weeklyDiscount: v.optional(v.number()),
    monthlyDiscount: v.optional(v.number()),
    maxNights: v.optional(v.number()),
    minNights: v.optional(v.number()),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    bedsCount: v.optional(v.number()),
    roomType: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    bookingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { existingId, ...data } = args;
    const now = Date.now();

    if (existingId) {
      // Update existing property
      await ctx.db.patch(existingId, {
        ...data,
        isActive: true,
        updatedAt: now,
      });
      return { action: "updated" as const, id: existingId };
    } else {
      // Create new property
      const id = await ctx.db.insert("properties", {
        ...data,
        isActive: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      });
      return { action: "created" as const, id };
    }
  },
});

// ── Mutation: bulk upsert calendar availability ──
export const upsertCalendarBookings = internalMutation({
  args: {
    propertyId: v.id("properties"),
    bookings: v.array(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
        source: v.union(
          v.literal("hostaway"),
          v.literal("airbnb"),
          v.literal("hht"),
          v.literal("manual")
        ),
        summary: v.optional(v.string()),
        uid: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { propertyId, bookings }) => {
    // Delete existing hostaway-sourced bookings for this property
    const existing = await ctx.db
      .query("calendarBookings")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .collect();

    const hostawayBookings = existing.filter(
      (b) => (b as any).source === "hostaway"
    );
    for (const b of hostawayBookings) {
      await ctx.db.delete(b._id);
    }

    // Insert new bookings
    const now = Date.now();
    let inserted = 0;
    for (const booking of bookings) {
      await ctx.db.insert("calendarBookings", {
        propertyId,
        startDate: booking.startDate,
        endDate: booking.endDate,
        source: booking.source as any,
        summary: booking.summary,
        uid: booking.uid,
        createdAt: now,
      });
      inserted++;
    }

    return { deleted: hostawayBookings.length, inserted };
  },
});
