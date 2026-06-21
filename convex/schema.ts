import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  // ── Communities ──
  // The 8 Sea Pines communities: Swallowtail, Spicebush, Racquet Club,
  // Plantation Club, Night Heron, Port Villa, Twin Oaks, Ketch Court
  communities: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
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
    wpPageId: v.optional(v.number()), // original WordPress page ID for migration
    wpSlug: v.optional(v.string()),
    // House rules, cancellation, etc.
    houseRules: v.optional(v.string()),
    cancellationPolicy: v.optional(v.string()),
    checkInInfo: v.optional(v.string()),
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
    price: v.optional(v.number()), // in dollars
    priceLabel: v.optional(v.string()), // e.g. "Contact for pricing"
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("pending"),
      v.literal("sold"),
      v.literal("not_listed")
    ),
    // Which year(s) this applies to
    year: v.optional(v.number()),
    isAnnual: v.optional(v.boolean()), // true = every year, false = specific year
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_property", ["propertyId"])
    .index("by_week", ["weekNumber"])
    .index("by_status", ["status"])
    .index("by_property_week", ["propertyId", "weekNumber"]),

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
});

export default schema;
