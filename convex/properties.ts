import { v } from "convex/values";
import { allowedCommunityIds } from "./sites";
import { query, mutation } from "./_generated/server";

/** Detect amenities from amenityTags (Hostaway), featureCategories text, + community amenities. */
function detectAmenities(
  featureCategories: Record<string, string | undefined> | undefined,
  communityAmenities?: string[],
  amenityTags?: string[],
): string[] {
  const result: string[] = [];

  // Hostaway amenityTags (proper amenity names like "Pool", "Free WiFi")
  if (amenityTags && amenityTags.length > 0) {
    for (const a of amenityTags) {
      if (!result.includes(a)) result.push(a);
    }
  }

  // Text-based amenities from featureCategories (legacy property-level)
  if (featureCategories) {
    const text = Object.values(featureCategories).filter(Boolean).join(" ").toLowerCase();
    if (/\bpool\b/.test(text) && !result.some(a => a.toLowerCase() === "pool")) result.push("pool");
    if (/hot tub|jacuzzi|\bspa\b/.test(text) && !result.some(a => a.toLowerCase().includes("hot tub"))) result.push("hot_tub");
    if (/tennis/.test(text) && !result.some(a => a.toLowerCase().includes("tennis"))) result.push("tennis");
    if (/grill|bbq|barbecue/.test(text) && !result.some(a => a.toLowerCase().includes("grill") || a.toLowerCase().includes("bbq"))) result.push("grill");
  }

  // Community-level amenities (stored in DB, editable from admin)
  if (communityAmenities && communityAmenities.length > 0) {
    for (const a of communityAmenities) {
      if (!result.includes(a)) result.push(a);
    }
  }

  return result;
}

// ── Public Queries ──

export const list = query({
  args: {
    communityId: v.optional(v.id("communities")),
    onlyActive: v.optional(v.boolean()),
    onlyFeatured: v.optional(v.boolean()),
    siteSlug: v.optional(v.string()),
  },
  handler: async (ctx, { communityId, onlyActive = true, onlyFeatured, siteSlug }) => {
    let q;
    if (communityId) {
      q = ctx.db
        .query("properties")
        .withIndex("by_community", (idx) => idx.eq("communityId", communityId));
    } else {
      q = ctx.db.query("properties");
    }

    let properties = await q.collect();

    // Site scoping (server-enforced).
    const allowedList = await allowedCommunityIds(ctx, siteSlug);
    if (allowedList) {
      properties = properties.filter((p) =>
        allowedList.has(p.communityId as string)
      );
    }

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

    // Get all photos — prefer propertyPhotos table, fall back to photoUrls field
    const photoRecords = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();
    let photoUrls: (string | null)[];
    if (photoRecords.length > 0) {
      photoUrls = await Promise.all(
        photoRecords
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(async (p) => {
            if (p.storageId) {
              return await ctx.storage.getUrl(p.storageId);
            }
            return p.externalUrl ?? null;
          })
      );
    } else {
      // Fall back to photoUrls stored directly on the property
      photoUrls = property.photoUrls ?? [];
    }

    // Get available weeks
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();

    return {
      ...property,
      communityName: community?.name ?? "Unknown",
      communitySlug: community?.slug ?? "",
      communityFeatures: community?.features ?? {},
      communityAmenities: community?.amenities ?? [],
      photos: photoUrls.filter(Boolean) as string[],
      weeks: weeks
        .filter((w) => w.status === "available")
        .sort((a, b) => a.weekNumber - b.weekNumber),
    };
  },
});

/**
 * Returns lightweight property + weeks data for client-side faceted filtering.
 * With ~80 properties this is very efficient.
 */
export const listForFacets = query({
  args: { siteSlug: v.optional(v.string()) },
  handler: async (ctx, { siteSlug }) => {
    let properties = await ctx.db
      .query("properties")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Site scoping (server-enforced): facet counts must describe only the
    // inventory this site can actually show.
    const allowedFacets = await allowedCommunityIds(ctx, siteSlug);
    if (allowedFacets) {
      properties = properties.filter((p) =>
        allowedFacets.has(p.communityId as string)
      );
    }

    return Promise.all(
      properties.filter((p) => p.isActive).map(async (p) => {
        const community = await ctx.db.get(p.communityId);
        const weeks = await ctx.db
          .query("weeks")
          .withIndex("by_property", (q) => q.eq("propertyId", p._id))
          .collect();
        const availableWeeks = weeks.filter((w) => w.status === "available");
        const availableWeekNumbers = availableWeeks.map((w) => w.weekNumber);

        // Check if any available week is listed for rent or sale
        const hasRentalWeeks = availableWeeks.some(
          (w: any) => w.listingType === "rent" || w.listingType === "both"
        );
        const hasSaleWeeks = availableWeeks.some(
          (w: any) => w.listingType === "sale" || w.listingType === "both" || !w.listingType
        );

        return {
          _id: p._id,
          communitySlug: community?.slug ?? "",
          bedrooms: p.bedrooms,
          hasBookingUrl: !!p.bookingUrl,
          hasRentalWeeks,
          hasSaleWeeks,
          availableWeeks: availableWeekNumbers,
          amenities: detectAmenities(p.featureCategories as any, community?.amenities, p.amenityTags),
        };
      })
    );
  },
});

export const search = query({
  args: {
    communityId: v.optional(v.id("communities")),
    communitySlug: v.optional(v.string()),
    communitySlugs: v.optional(v.array(v.string())),
    weekNumber: v.optional(v.number()),
    weekNumbers: v.optional(v.array(v.number())),
    minBedrooms: v.optional(v.number()),
    bedroomValues: v.optional(v.array(v.number())),
    maxPrice: v.optional(v.number()),
    listingType: v.optional(v.string()),
    listingTypes: v.optional(v.array(v.string())),
    amenities: v.optional(v.array(v.string())),
    amenityMode: v.optional(v.union(v.literal("and"), v.literal("or"))),
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
    // Free-text query from the header search bar — matches property name,
    // address or community name [scott, 2026-09-10].
    q: v.optional(v.string()),
    // Party size from the header search bar's "Who" field.
    minSleeps: v.optional(v.number()),
    // Multi-site scoping. Enforced server-side: a site can never be coaxed
    // into returning another site's inventory by sending different slugs.
    siteSlug: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { communityId, communitySlug, communitySlugs, weekNumber, weekNumbers, minBedrooms, bedroomValues, maxPrice, listingType, listingTypes, amenities, amenityMode, checkIn, checkOut, q, minSleeps, siteSlug }
  ) => {
    // Resolve community filters — support single or multi
    const slugsToFilter = communitySlugs?.length
      ? communitySlugs
      : communitySlug
        ? [communitySlug]
        : [];

    const communityIds: Set<string> = new Set();
    if (communityId) {
      communityIds.add(communityId);
    }
    for (const slug of slugsToFilter) {
      const comm = await ctx.db
        .query("communities")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (comm) communityIds.add(comm._id);
    }

    // ── Site scoping (server-enforced) ──
    // Resolve the site's allowed communities and intersect. Requested filters
    // can narrow within a site's inventory but never widen beyond it.
    let siteAllowed: Set<string> | null = null;
    if (siteSlug) {
      const site = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
        .unique();
      if (site && site.scopeMode === "communities") {
        const allowedSlugs = new Set(site.communitySlugs ?? []);
        const comms = await ctx.db.query("communities").collect();
        siteAllowed = new Set(
          comms.filter((c) => allowedSlugs.has(c.slug)).map((c) => c._id as string)
        );
        if (communityIds.size === 0) {
          for (const id of siteAllowed) communityIds.add(id);
        } else {
          for (const id of [...communityIds]) {
            if (!siteAllowed.has(id)) communityIds.delete(id);
          }
          // Requested communities all outside this site -> no results.
          if (communityIds.size === 0) return [];
        }
      }
    }

    // Start with all active properties
    let properties;
    if (communityIds.size === 1) {
      const [cid] = communityIds;
      properties = await ctx.db
        .query("properties")
        .withIndex("by_community", (q) => q.eq("communityId", cid as any))
        .collect();
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }

    properties = properties.filter((p) => p.isActive);

    // Belt-and-braces: enforce site scope even on the "all properties" branch.
    if (siteAllowed) {
      properties = properties.filter((p) =>
        siteAllowed!.has(p.communityId as unknown as string)
      );
    }

    // Multi-community filter
    if (communityIds.size > 1) {
      properties = properties.filter((p) => communityIds.has(p.communityId));
    }

    // Guest-count filter. `sleeps` is populated for every property from the
    // HostAway sync; a property missing it is excluded rather than guessed at.
    if (minSleeps && minSleeps > 0) {
      properties = properties.filter((p) => (p.sleeps ?? 0) >= minSleeps);
    }

    // Free-text filter — property name, address, or community name.
    const term = q?.trim().toLowerCase();
    if (term) {
      const commNameCache: Map<string, string> = new Map();
      for (const p of properties) {
        if (!commNameCache.has(p.communityId)) {
          const comm = await ctx.db.get(p.communityId);
          commNameCache.set(p.communityId, (comm?.name ?? "").toLowerCase());
        }
      }
      properties = properties.filter((p) => {
        // `as any`: the generated union for `properties` doesn't surface these
        // optional fields, the same pre-existing typing quirk that affects
        // admin.ts and booking.ts. The fields exist at runtime.
        const prop = p as any;
        const haystack = [
          prop.name ?? "",
          prop.address ?? "",
          commNameCache.get(p.communityId) ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return term.split(/\s+/).every((word) => haystack.includes(word));
      });
    }

    // Bedroom filter — multi or single
    const bedFilter = bedroomValues?.length ? bedroomValues : minBedrooms ? [minBedrooms] : [];
    if (bedFilter.length > 0) {
      const minBed = Math.min(...bedFilter);
      properties = properties.filter((p) => p.bedrooms >= minBed);
    }

    // Amenity filter
    if (amenities && amenities.length > 0) {
      // Pre-resolve community slugs for location-based amenity detection
      const commAmenityCache: Map<string, string[]> = new Map();
      for (const p of properties) {
        if (!commAmenityCache.has(p.communityId)) {
          const comm = await ctx.db.get(p.communityId);
          commAmenityCache.set(p.communityId, comm?.amenities ?? []);
        }
      }
      properties = properties.filter((p) => {
        const propAmenities = detectAmenities(p.featureCategories as any, commAmenityCache.get(p.communityId), p.amenityTags);
        const matcher = (amenityMode ?? "and") === "or"
          ? amenities.some((a) => propAmenities.includes(a))
          : amenities.every((a) => propAmenities.includes(a));
        return matcher;
      });
    }

    // Listing type filter — multi or single
    const typeFilter = listingTypes?.length ? listingTypes : listingType ? [listingType] : [];
    const wantRent = typeFilter.includes("rent");
    const wantBuy = typeFilter.includes("buy");

    // Week filter — multi or single
    const weekFilter = weekNumbers?.length
      ? weekNumbers
      : weekNumber
        ? [weekNumber]
        : [];

    // If filtering by listing type, week, or price, check weeks table
    const needWeeksFilter = weekFilter.length > 0 || maxPrice || wantRent || wantBuy;
    if (needWeeksFilter) {
      const filtered = [];
      for (const p of properties) {
        const weeks = await ctx.db
          .query("weeks")
          .withIndex("by_property", (q) => q.eq("propertyId", p._id))
          .collect();
        const availableWeeks = weeks.filter(
          (w) => w.status === "available" || w.status === "pending"
        );

        // Listing type filter — check weeks' listingType field
        let typeFilteredWeeks = availableWeeks;
        if (wantRent && !wantBuy) {
          typeFilteredWeeks = typeFilteredWeeks.filter(
            (w: any) => w.listingType === "rent" || w.listingType === "both" || !w.listingType
          );
          // Fallback: also include if property has a bookingUrl (legacy)
          if (typeFilteredWeeks.length === 0 && p.bookingUrl) {
            filtered.push(p);
            continue;
          }
        }
        if (wantBuy && !wantRent) {
          typeFilteredWeeks = typeFilteredWeeks.filter(
            (w: any) => w.listingType === "sale" || w.listingType === "both" || !w.listingType
          );
          if (typeFilteredWeeks.length === 0) continue;
        }
        if (wantRent && wantBuy) {
          // Either type works
        }

        if ((wantRent || wantBuy) && typeFilteredWeeks.length === 0) continue;

        let matchingWeeks = typeFilteredWeeks;
        if (weekFilter.length > 0) {
          const weekSet = new Set(weekFilter);
          matchingWeeks = matchingWeeks.filter((w) => weekSet.has(w.weekNumber));
        }
        if (maxPrice) {
          matchingWeeks = matchingWeeks.filter(
            (w: any) => (w.price && w.price <= maxPrice) || (w.rentPrice && w.rentPrice <= maxPrice)
          );
        }
        if ((weekFilter.length > 0 || maxPrice) && matchingWeeks.length === 0) continue;

        filtered.push(p);
      }
      properties = filtered;
    }

    // ── Availability filter: exclude properties booked during requested dates ──
    if (checkIn && checkOut) {
      const available: typeof properties = [];
      for (const p of properties) {
        const bookings = await ctx.db
          .query("calendarBookings")
          .withIndex("by_property", (q) => q.eq("propertyId", p._id))
          .collect();
        // Check for overlap: booking overlaps [checkIn, checkOut) if
        // booking.startDate < checkOut AND booking.endDate > checkIn
        const hasConflict = bookings.some(
          (b) => b.startDate < checkOut && b.endDate > checkIn
        );
        if (!hasConflict) {
          available.push(p);
        }
      }
      properties = available;
    }

    // Resolve community names, primary photos, and pricing summaries
    return Promise.all(
      properties.map(async (p) => {
        const community = await ctx.db.get(p.communityId);
        let photoUrl: string | null = null;
        if (p.photoUrls && p.photoUrls.length > 0) {
          photoUrl = p.photoUrls[0];
        }

        // Compute pricing summaries for card badges
        const weeks = await ctx.db
          .query("weeks")
          .withIndex("by_property", (q) => q.eq("propertyId", p._id))
          .collect();
        const availableWeeks = weeks.filter((w) => w.status === "available");
        const saleWeeks = availableWeeks.filter(
          (w: any) => w.listingType === "sale" || w.listingType === "both" || !w.listingType
        );
        const salePrices = saleWeeks.map((w) => w.price).filter(Boolean) as number[];
        const lowestSalePrice = salePrices.length > 0 ? Math.min(...salePrices) : null;

        return {
          ...p,
          communityName: community?.name ?? "Unknown",
          communitySlug: community?.slug ?? "",
          photoUrl,
          nightlyRate: (p as any).nightlyRate ?? null,
          lowestSalePrice,
          saleWeekCount: saleWeeks.length,
        };
      })
    );
  },
});

// ── Admin Mutations ──

export const updateLinks = mutation({
  args: {
    slug: v.string(),
    bookingUrl: v.optional(v.string()),
    calendarUrl: v.optional(v.string()),
    ownerDocsUrl: v.optional(v.string()),
  },
  handler: async (ctx, { slug, bookingUrl, calendarUrl, ownerDocsUrl }) => {
    const property = await ctx.db
      .query("properties")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!property) return null;
    const updates: Record<string, string> = {};
    if (bookingUrl) updates.bookingUrl = bookingUrl;
    if (calendarUrl) updates.calendarUrl = calendarUrl;
    if (ownerDocsUrl) updates.ownerDocsUrl = ownerDocsUrl;
    await ctx.db.patch(property._id, updates);
    return property._id;
  },
});

export const updateFeatureCategories = mutation({
  args: {
    slug: v.string(),
    featureCategories: v.object({
      heating_and_cooling: v.optional(v.string()),
      kitchen_and_dining: v.optional(v.string()),
      appliances: v.optional(v.string()),
      interior_features: v.optional(v.string()),
      garage_and_parking: v.optional(v.string()),
      exterior_features: v.optional(v.string()),
      views_and_location: v.optional(v.string()),
      activities: v.optional(v.string()),
      utilities: v.optional(v.string()),
      security: v.optional(v.string()),
      essentials: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { slug, featureCategories }) => {
    const property = await ctx.db
      .query("properties")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!property) return null;
    await ctx.db.patch(property._id, { featureCategories });
    return property._id;
  },
});

export const updateCoords = mutation({
  args: {
    slug: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, { slug, latitude, longitude }) => {
    const property = await ctx.db
      .query("properties")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!property) return null;
    await ctx.db.patch(property._id, { latitude, longitude });
    return property._id;
  },
});

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

// ── All unique amenities (for dynamic filter options) ──
export const allAmenities = query({
  args: { siteSlug: v.optional(v.string()) },
  handler: async (ctx, { siteSlug }) => {
    const allowedAmen = await allowedCommunityIds(ctx, siteSlug);
    let communities = await ctx.db.query("communities").collect();
    if (allowedAmen) {
      communities = communities.filter((c) => allowedAmen.has(c._id as string));
    }
    const amenitySet = new Set<string>();

    // Gather all community-level amenities
    for (const c of communities) {
      if (c.amenities) {
        for (const a of c.amenities) amenitySet.add(a);
      }
    }

    // Gather property-level amenityTags (from Hostaway sync)
    let properties = await ctx.db
      .query("properties")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    if (allowedAmen) {
      properties = properties.filter((p) =>
        allowedAmen.has(p.communityId as string)
      );
    }
    for (const p of properties) {
      if (p.amenityTags) {
        for (const a of p.amenityTags) amenitySet.add(a);
      }
      // Legacy: text-detected amenities from featureCategories
      if (p.featureCategories) {
        const text = Object.values(p.featureCategories).filter(Boolean).join(" ").toLowerCase();
        if (/\bpool\b/.test(text)) amenitySet.add("pool");
        if (/hot tub|jacuzzi|\bspa\b/.test(text)) amenitySet.add("hot_tub");
        if (/tennis/.test(text)) amenitySet.add("tennis");
        if (/grill|bbq|barbecue/.test(text)) amenitySet.add("grill");
      }
    }

    return Array.from(amenitySet).sort();
  },
});

// ── Calendar view: weeks with property + community info ──
export const searchWeeksForCalendar = query({
  args: {
    communitySlugs: v.optional(v.array(v.string())),
    weekNumbers: v.optional(v.array(v.number())),
    bedroomValues: v.optional(v.array(v.number())),
    listingTypes: v.optional(v.array(v.string())),
    amenities: v.optional(v.array(v.string())),
    amenityMode: v.optional(v.union(v.literal("and"), v.literal("or"))),
    siteSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Start with all active properties
    let properties = await ctx.db
      .query("properties")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    properties = properties.filter((p) => p.isActive);

    // Site scoping (server-enforced).
    const allowedCal = await allowedCommunityIds(ctx, args.siteSlug);
    if (allowedCal) {
      properties = properties.filter((p) =>
        allowedCal.has(p.communityId as string)
      );
    }

    // Community filter
    if (args.communitySlugs && args.communitySlugs.length > 0) {
      const slugSet = new Set(args.communitySlugs);
      const comms = await ctx.db.query("communities").collect();
      const idSet = new Set(comms.filter((c) => slugSet.has(c.slug)).map((c) => c._id));
      properties = properties.filter((p) => idSet.has(p.communityId));
    }

    // Bedroom filter
    if (args.bedroomValues && args.bedroomValues.length > 0) {
      const minBed = Math.min(...args.bedroomValues);
      properties = properties.filter((p) => p.bedrooms >= minBed);
    }

    // Amenity filter
    if (args.amenities && args.amenities.length > 0) {
      const commAmenityCache: Map<string, string[]> = new Map();
      for (const p of properties) {
        if (!commAmenityCache.has(p.communityId)) {
          const comm = await ctx.db.get(p.communityId);
          commAmenityCache.set(p.communityId, comm?.amenities ?? []);
        }
      }
      properties = properties.filter((p) => {
        const propAmenities = detectAmenities(p.featureCategories as any, commAmenityCache.get(p.communityId), p.amenityTags);
        return (args.amenityMode ?? "or") === "or"
          ? args.amenities!.some((a) => propAmenities.includes(a))
          : args.amenities!.every((a) => propAmenities.includes(a));
      });
    }

    // Gather all weeks for matched properties
    const results: {
      weekNumber: number;
      listingType: string;
      status: string;
      price?: number;
      rentPrice?: number;
      priceLabel?: string;
      year?: number;
      isAnnual?: boolean;
      propertyId: string;
      propertyAddress: string;
      propertySlug: string;
      communityName: string;
      communitySlug: string;
      bedrooms: number;
      photoUrl: string | null;
    }[] = [];

    const wantRent = args.listingTypes?.includes("rent");
    const wantBuy = args.listingTypes?.includes("buy");

    for (const p of properties) {
      const community = await ctx.db.get(p.communityId);
      const weeks = await ctx.db
        .query("weeks")
        .withIndex("by_property", (q) => q.eq("propertyId", p._id))
        .collect();

      let available = weeks.filter((w) => w.status === "available" || w.status === "pending");

      // Listing type filter
      if (wantRent && !wantBuy) {
        available = available.filter(
          (w: any) => w.listingType === "rent" || w.listingType === "both" || !w.listingType
        );
      }
      if (wantBuy && !wantRent) {
        available = available.filter(
          (w: any) => w.listingType === "sale" || w.listingType === "both" || !w.listingType
        );
      }

      // Week number filter
      if (args.weekNumbers && args.weekNumbers.length > 0) {
        const weekSet = new Set(args.weekNumbers);
        available = available.filter((w) => weekSet.has(w.weekNumber));
      }

      const photoUrl = p.photoUrls && p.photoUrls.length > 0 ? p.photoUrls[0] : null;

      for (const w of available) {
        results.push({
          weekNumber: w.weekNumber,
          listingType: (w as any).listingType ?? "both",
          status: w.status,
          price: w.price,
          rentPrice: (w as any).rentPrice,
          priceLabel: w.priceLabel,
          year: w.year,
          isAnnual: w.isAnnual,
          propertyId: p._id,
          propertyAddress: p.address,
          propertySlug: p.slug,
          communityName: community?.name ?? "Unknown",
          communitySlug: community?.slug ?? "",
          bedrooms: p.bedrooms,
          photoUrl,
        });
      }
    }

    return results.sort((a, b) => a.weekNumber - b.weekNumber);
  },
});
