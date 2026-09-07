import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  // ── User Profiles (role-based access) ──
  userProfiles: defineTable({
    userId: v.optional(v.id("users")), // optional for pre-registered owners (linked on first login)
    role: v.union(
      v.literal("admin"),        // Super User — full access + user management
      v.literal("admin_user"),   // User — content management, no user management
      v.literal("admin_rental"),
      v.literal("admin_sales"),
      v.literal("owner"),
      v.literal("renter")
    ),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    // Owner profile fields
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    homeState: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
    homePostalCode: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  // ── Sites ──
  // One deployment serves four hostnames. A site record decides which
  // properties, content, theme and owner pool a request sees.
  // Property scoping is a RULE ON COMMUNITY, never per-property tagging.
  sites: defineTable({
    slug: v.string(),                 // "heritage" | "mhht" | "swallowtail" | "spicebush"
    name: v.string(),
    domain: v.string(),               // canonical production hostname
    altDomains: v.optional(v.array(v.string())), // preview/staging/www variants
    tagline: v.optional(v.string()),
    // Inventory scoping: "all" = every property; "communities" = only listed slugs
    scopeMode: v.union(v.literal("all"), v.literal("communities")),
    communitySlugs: v.optional(v.array(v.string())),
    // Feature flags
    ownerPortalEnabled: v.boolean(),  // Swallowtail + Spicebush only
    marketplaceEnabled: v.boolean(),  // joint buy/sell/trade pool
    rentalsEnabled: v.boolean(),
    // Joint marketplace pool key — sites sharing a key cross-populate listings
    marketplacePool: v.optional(v.string()),
    // Theming
    theme: v.optional(v.object({
      primary: v.optional(v.string()),
      accent: v.optional(v.string()),
      logoStorageId: v.optional(v.id("_storage")),
    })),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_domain", ["domain"]),

  // ── Communities ──
  // The 8 Sea Pines communities: Swallowtail, Spicebush, Racquet Club,
  // Plantation Club, Night Heron, Port Villa, Twin Oaks, Ketch Court
  communities: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    // Feature categories (editable, shared across all properties in this community)
    features: v.optional(v.record(v.string(), v.string())),
    // Map center coordinates
    latitude: v.number(),
    longitude: v.number(),
    // Media
    heroImageId: v.optional(v.id("_storage")),
    siteMapImageId: v.optional(v.id("_storage")),
    floorPlanImageIds: v.optional(v.array(v.id("_storage"))),
    galleryImageIds: v.optional(v.array(v.id("_storage"))),
    // Metadata
    propertyCount: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_sortOrder", ["sortOrder"]),

  // ── Properties (Villas) ──
  properties: defineTable({
    // Identity
    address: v.string(), // e.g. "2870 Swallowtail"
    slug: v.string(), // e.g. "2870-swallowtail"
    unitNumber: v.string(), // e.g. "2870"
    communityId: v.id("communities"),
    // Details
    bedrooms: v.number(),
    bathrooms: v.number(),
    sleeps: v.optional(v.number()),
    squareFeet: v.optional(v.number()),
    description: v.optional(v.string()),
    // Features (structured)
    features: v.optional(
      v.object({
        heating: v.optional(v.array(v.string())),
        cooling: v.optional(v.array(v.string())),
        kitchen: v.optional(v.array(v.string())),
        bathroom: v.optional(v.array(v.string())),
        entertainment: v.optional(v.array(v.string())),
        outdoor: v.optional(v.array(v.string())),
        parking: v.optional(v.array(v.string())),
        accessibility: v.optional(v.array(v.string())),
        other: v.optional(v.array(v.string())),
      })
    ),
    // Amenities (flat list for search filtering)
    amenityTags: v.optional(v.array(v.string())),
    // Visual feature categories (scraped from WP)
    featureCategories: v.optional(
      v.object({
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
      })
    ),
    // Location
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    // Photos
    photoIds: v.optional(v.array(v.id("_storage"))),
    photoUrls: v.optional(v.array(v.string())), // fallback to external URLs
    // Status
    isActive: v.boolean(),
    isFeatured: v.optional(v.boolean()),
    // Owner (Phase 2 — owner self-service)
    ownerId: v.optional(v.id("users")),
    // External references
    hostawayId: v.optional(v.number()), // Hostaway listing ID for API sync
    wpPageId: v.optional(v.number()), // original WordPress page ID for migration
    wpSlug: v.optional(v.string()),
    // Rental details (from Hostaway)
    nightlyRate: v.optional(v.number()),    // nightly rental price in dollars
    cleaningFee: v.optional(v.number()),    // one-time cleaning fee
    weeklyDiscount: v.optional(v.number()), // e.g. 0.75 = 25% off for weekly stays
    monthlyDiscount: v.optional(v.number()),// e.g. 0.5 = 50% off for monthly stays
    maxNights: v.optional(v.number()),      // maximum stay length in nights
    minNights: v.optional(v.number()),      // minimum stay length in nights
    // Check-in / check-out
    checkInTime: v.optional(v.string()),    // e.g. "4:00 PM"
    checkOutTime: v.optional(v.string()),   // e.g. "10:00 AM"
    checkinType: v.optional(v.string()),    // "keypad", "lockbox", "smartlock"
    // Bed configuration
    bedsCount: v.optional(v.number()),      // total number of beds
    bedTypes: v.optional(v.array(v.string())), // ["King Bed", "Single Bed", ...]
    roomType: v.optional(v.string()),       // "Deluxe Villa", "Two-Bedroom House", etc.
    // Contact
    contactPhone: v.optional(v.string()),
    // House rules, cancellation, etc.
    houseRules: v.optional(v.string()),
    cancellationPolicy: v.optional(v.string()),
    checkInInfo: v.optional(v.string()),
    // External links
    bookingUrl: v.optional(v.string()), // Heritage Vacations booking link
    calendarUrl: v.optional(v.string()), // Annual calendar PDF
    ownerDocsUrl: v.optional(v.string()), // Owner documents page
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_community", ["communityId"])
    .index("by_active", ["isActive"])
    .index("by_featured", ["isFeatured"])
    .index("by_owner", ["ownerId"])
    .searchIndex("search_address", {
      searchField: "address",
      filterFields: ["communityId", "isActive"],
    }),

  // ── Weeks (Timeshare Weeks Available) ──
  weeks: defineTable({
    propertyId: v.id("properties"),
    weekNumber: v.number(), // 1–52
    // Listing type: rent, sale, or both
    listingType: v.optional(
      v.union(v.literal("rent"), v.literal("sale"), v.literal("both"))
    ),
    // Pricing — separate rent and sale prices
    price: v.optional(v.number()), // sale price in dollars
    rentPrice: v.optional(v.number()), // weekly rental price in dollars
    priceLabel: v.optional(v.string()), // e.g. "Contact for pricing"
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("pending"),
      v.literal("sold"),
      v.literal("rented"),
      v.literal("not_listed")
    ),
    // Which year(s) this applies to
    year: v.optional(v.number()),
    isAnnual: v.optional(v.boolean()), // true = every year, false = specific year
    // Owner of this specific week (may differ from property owner)
    ownerId: v.optional(v.id("userProfiles")),
    // iCal sync — Airbnb calendar integration
    airbnbCalendarUrl: v.optional(v.string()), // Airbnb iCal export URL
    lastSyncAt: v.optional(v.number()), // last time Airbnb feed was fetched
    lastSyncError: v.optional(v.string()), // error message if sync failed
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_property", ["propertyId"])
    .index("by_week", ["weekNumber"])
    .index("by_status", ["status"])
    .index("by_property_week", ["propertyId", "weekNumber"])
    .index("by_owner", ["ownerId"]),

  // ── Calendar Bookings (synced from Airbnb iCal + local) ──
  calendarBookings: defineTable({
    weekId: v.optional(v.id("weeks")),
    propertyId: v.id("properties"),
    // Date range
    startDate: v.string(), // ISO date: "2026-07-05"
    endDate: v.string(),   // ISO date: "2026-07-12"
    // Source
    source: v.union(
      v.literal("airbnb"),    // synced from Airbnb iCal
      v.literal("hostaway"),  // synced from Hostaway API
      v.literal("hht"),       // booked on HHT directly
      v.literal("manual")     // admin-entered
    ),
    // Details
    summary: v.optional(v.string()), // from iCal SUMMARY (usually "Reserved" or "Not available")
    uid: v.optional(v.string()), // iCal UID for dedup
    guestName: v.optional(v.string()), // for HHT/manual bookings
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_week", ["weekId"])
    .index("by_property", ["propertyId"])
    .index("by_dates", ["propertyId", "startDate"])
    .index("by_uid", ["uid"]),

  // ── Inquiries ──
  inquiries: defineTable({
    type: v.union(v.literal("purchase"), v.literal("rental")),
    propertyId: v.optional(v.id("properties")),
    weekId: v.optional(v.id("weeks")),
    // Contact info
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
    // Routing
    routedTo: v.optional(v.string()), // email address it was sent to
    // Status
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("closed")
    ),
    // Timestamps
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_property", ["propertyId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // ── Property Photos (metadata) ──
  propertyPhotos: defineTable({
    propertyId: v.id("properties"),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()), // fallback URL from WordPress
    caption: v.optional(v.string()),
    sortOrder: v.number(),
    isPrimary: v.optional(v.boolean()),
  })
    .index("by_property", ["propertyId"])
    .index("by_primary", ["propertyId", "isPrimary"]),

  // ── Community Documents (site maps, floor plans) ──
  communityDocuments: defineTable({
    communityId: v.id("communities"),
    type: v.union(
      v.literal("site_map"),
      v.literal("floor_plan"),
      v.literal("amenity_map"),
      v.literal("other")
    ),
    title: v.string(),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  }).index("by_community", ["communityId"]),

  // ── Sale Requests (Owner "Sell My Week" submissions) ──
  saleRequests: defineTable({
    weekId: v.id("weeks"),
    propertyId: v.id("properties"),
    ownerId: v.id("userProfiles"),
    weekNumber: v.number(),
    askingPrice: v.number(),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),    // awaiting admin review
      v.literal("approved"),   // admin approved → week listed for sale
      v.literal("rejected"),   // admin declined
      v.literal("cancelled")   // owner withdrew
    ),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_property", ["propertyId"])
    .index("by_status", ["status"])
    .index("by_week", ["weekId"]),

  // ── Bookings (checkout reservations) ──
  bookings: defineTable({
    // Booking type: "week" (purchase) or "rental" (date-based)
    bookingType: v.optional(v.union(v.literal("week"), v.literal("rental"))),
    // Week-based bookings
    weekId: v.optional(v.id("weeks")),
    weekNumber: v.optional(v.number()),
    // Shared
    propertyId: v.id("properties"),
    // Guest info
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    // Booking details
    startDate: v.string(),
    endDate: v.string(),
    price: v.number(),
    // Rental-specific
    nightlyRate: v.optional(v.number()),
    nights: v.optional(v.number()),
    cleaningFee: v.optional(v.number()),
    // Status
    status: v.union(
      v.literal("pending"),    // checkout started, awaiting payment
      v.literal("confirmed"),  // payment received
      v.literal("cancelled"),  // cancelled
    ),
    // Payment (placeholder for future processor)
    paymentMethod: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    // Notes
    notes: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_week", ["weekId"])
    .index("by_property", ["propertyId"])
    .index("by_status", ["status"])
    .index("by_email", ["email"]),
});

export default schema;
