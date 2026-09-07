import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function formatPhone(value?: string): string | undefined {
  if (!value) return value;
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Get week + property details for week-based checkout ──
export const getCheckoutData = query({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, { weekId }) => {
    const week = await ctx.db.get(weekId);
    if (!week) return null;

    const property = await ctx.db.get(week.propertyId);
    if (!property) return null;

    const community = property.communityId
      ? await ctx.db.get(property.communityId)
      : null;

    let photoUrl: string | null = null;
    if (property.photoUrls && property.photoUrls.length > 0) {
      photoUrl = property.photoUrls[0];
    }

    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_week", (q) => q.eq("weekId", weekId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "confirmed")
        )
      )
      .first();

    return {
      week: {
        _id: week._id,
        weekNumber: week.weekNumber,
        startDate: week.startDate,
        endDate: week.endDate,
        rentPrice: week.rentPrice,
        listingType: week.listingType,
        rented: week.rented,
        year: week.year,
      },
      property: {
        _id: property._id,
        name: property.address ?? property.slug,
        slug: property.slug,
      },
      community: community
        ? { _id: community._id, name: community.name, slug: community.slug }
        : property.communityName
          ? { _id: property._id, name: property.communityName, slug: property.communitySlug ?? "" }
          : null,
      photoUrl,
      isBooked: !!existingBooking,
    };
  },
});

// ── Get property details for rental checkout (date-based) ──
export const getRentalCheckoutData = query({
  args: {
    propertyId: v.id("properties"),
    checkIn: v.string(),
    checkOut: v.string(),
  },
  handler: async (ctx, { propertyId, checkIn, checkOut }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) return null;

    const community = property.communityId
      ? await ctx.db.get(property.communityId)
      : null;

    let photoUrl: string | null = null;
    if (property.photoUrls && property.photoUrls.length > 0) {
      photoUrl = property.photoUrls[0];
    }

    // Calculate nights and total price
    const d1 = new Date(checkIn + "T12:00:00");
    const d2 = new Date(checkOut + "T12:00:00");
    const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
    const nightlyRate = (property as any).nightlyRate ?? 0;
    const cleaningFee = (property as any).cleaningFee ?? 0;
    const totalPrice = nightlyRate * nights + cleaningFee;

    return {
      property: {
        _id: property._id,
        name: property.address ?? property.slug,
        slug: property.slug,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      },
      community: community
        ? { _id: community._id, name: community.name, slug: community.slug }
        : property.communityName
          ? { _id: propertyId, name: property.communityName, slug: property.communitySlug ?? "" }
          : null,
      photoUrl,
      checkIn,
      checkOut,
      nights,
      nightlyRate,
      cleaningFee,
      totalPrice,
    };
  },
});

// ── Create week-based booking (checkout submit) ──
export const createBooking = mutation({
  args: {
    weekId: v.id("weeks"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const week = await ctx.db.get(args.weekId);
    if (!week) throw new Error("Week not found");

    const property = await ctx.db.get(week.propertyId);
    if (!property) throw new Error("Property not found");

    if (week.listingType === "sale") {
      throw new Error("This week is listed for sale only, not rental");
    }
    if (week.rented) {
      throw new Error("This week is already rented");
    }

    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_week", (q) => q.eq("weekId", args.weekId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "confirmed")
        )
      )
      .first();
    if (existingBooking) {
      throw new Error("This week already has an active booking");
    }

    const bookingId = await ctx.db.insert("bookings", {
      bookingType: "week",
      weekId: args.weekId,
      propertyId: week.propertyId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: formatPhone(args.phone) ?? args.phone,
      weekNumber: week.weekNumber,
      startDate: week.startDate ?? "",
      endDate: week.endDate ?? "",
      price: week.rentPrice ?? 0,
      status: "pending",
      notes: args.notes,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.weekId, { rented: true });

    await ctx.db.insert("calendarBookings", {
      weekId: args.weekId,
      propertyId: week.propertyId,
      startDate: week.startDate ?? "",
      endDate: week.endDate ?? "",
      source: "hht",
      summary: `Booked: ${args.firstName} ${args.lastName}`,
      guestName: `${args.firstName} ${args.lastName}`,
      createdAt: Date.now(),
    });

    return bookingId;
  },
});

// ── Create rental booking (date-based checkout submit) ──
export const createRentalBooking = mutation({
  args: {
    propertyId: v.id("properties"),
    checkIn: v.string(),
    checkOut: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    // ── Check for calendar conflicts ──
    const existingBookings = await ctx.db
      .query("calendarBookings")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();
    const hasConflict = existingBookings.some(
      (b) => b.startDate < args.checkOut && b.endDate > args.checkIn
    );
    if (hasConflict) {
      throw new Error(
        "These dates are not available. The property is already booked during part or all of your selected dates. Please choose different dates."
      );
    }

    const d1 = new Date(args.checkIn + "T12:00:00");
    const d2 = new Date(args.checkOut + "T12:00:00");
    const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
    const nightlyRate = (property as any).nightlyRate ?? 0;
    const cleaningFee = (property as any).cleaningFee ?? 0;
    const totalPrice = nightlyRate * nights + cleaningFee;

    const bookingId = await ctx.db.insert("bookings", {
      bookingType: "rental",
      propertyId: args.propertyId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: formatPhone(args.phone) ?? args.phone,
      startDate: args.checkIn,
      endDate: args.checkOut,
      price: totalPrice,
      nightlyRate,
      nights,
      cleaningFee: cleaningFee > 0 ? cleaningFee : undefined,
      status: "pending",
      notes: args.notes,
      createdAt: Date.now(),
    });

    // Create calendar booking entry
    await ctx.db.insert("calendarBookings", {
      propertyId: args.propertyId,
      startDate: args.checkIn,
      endDate: args.checkOut,
      source: "hht",
      summary: `Rental: ${args.firstName} ${args.lastName}`,
      guestName: `${args.firstName} ${args.lastName}`,
      createdAt: Date.now(),
    });

    return bookingId;
  },
});

// ── Get booking by ID (for confirmation page) ──
export const getBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;

    const property = await ctx.db.get(booking.propertyId);
    const week = booking.weekId ? await ctx.db.get(booking.weekId) : null;
    const community =
      property?.communityId ? await ctx.db.get(property.communityId) : null;

    return {
      ...booking,
      propertyName: property?.name ?? "Unknown",
      propertySlug: property?.slug ?? "",
      communityName: community?.name ?? "",
    };
  },
});
