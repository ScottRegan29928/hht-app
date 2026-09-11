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

    // Maintenance-fee payments differ per resort [scott, 2026-09-08]:
    // Swallowtail sends owners out to secure2.irm1.net; Spicebush collects on
    // site through Square. "none" keeps the nav item hidden entirely.
    paymentMode: v.optional(
      v.union(
        v.literal("none"),
        v.literal("external"),
        v.literal("square_link")
      )
    ),
    paymentUrl: v.optional(v.string()),
    paymentNote: v.optional(v.string()),
    // Theming
    theme: v.optional(v.object({
      primary: v.optional(v.string()),
      accent: v.optional(v.string()),
      logoStorageId: v.optional(v.id("_storage")),
    })),
    // Site-wide SEO defaults. Pages and posts override these individually; a
    // page that sets nothing inherits the whole block.
    seoDefaults: v.optional(v.object({
      titleSuffix: v.optional(v.string()),   // " | Swallowtail at Sea Pines"
      metaDescription: v.optional(v.string()),
      ogImageUrl: v.optional(v.string()),
      twitterHandle: v.optional(v.string()),
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
    // Per-property HostAway sync tracking. HostAway throttles requests from
    // Convex's egress, so a run may not cover every property; these let the
    // next run prioritise the stalest and surface anything going cold.
    hostawayLastSyncAt: v.optional(v.number()),
    hostawayLastSyncError: v.optional(v.string()),
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
    // "general" backs the site-wide Contact form [scott, 2026-09-08]; it has
    // no property attached, unlike purchase/rental which come off a listing.
    type: v.union(v.literal("purchase"), v.literal("rental"), v.literal("general")),
    // Which of the four sister sites the enquiry came from.
    siteSlug: v.optional(v.string()),
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

  // Small key/value store for integration state (currently the cached
  // HostAway access token). HostAway throttles token creation, so a cron
  // must reuse a token rather than minting one per run.
  syncState: defineTable({
    key: v.string(),
    value: v.string(),
    expiresAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ── Owner marketplace (Swallowtail + Spicebush joint pool) ──
  // Owner-to-owner resale and trade. This NEVER touches HostAway: HostAway
  // holds company-owned rental inventory, while everything here is a week
  // already sold to a person. The two processes run in tandem and never meet.
  //
  // Listings are pooled, not per-site: a Swallowtail owner's listing appears
  // in the Spicebush portal and vice versa ("joint listings"). Query by
  // `pool`, never by the origin site, or cross-population silently breaks.
  marketplaceListings: defineTable({
    pool: v.string(),                 // "seapines-joint"
    originSiteSlug: v.string(),       // where it was posted, for attribution only
    kind: v.union(
      v.literal("for_sale"),          // owner selling a week they hold
      v.literal("want_to_buy"),       // owner looking to buy a week
      v.literal("trade")              // one-time swap, not a permanent trade
    ),
    status: v.union(
      v.literal("active"),
      v.literal("closed"),            // deal done
      v.literal("withdrawn"),         // owner pulled it
      v.literal("expired")            // aged past one year
    ),

    // Author. Legacy rows imported from the WordPress tables have no account
    // yet, so ownerProfileId is optional and contact fields carry the details.
    ownerProfileId: v.optional(v.id("userProfiles")),
    isLegacy: v.optional(v.boolean()),

    // The week in question
    communitySlug: v.optional(v.string()),   // spicebush | swallowtail-at-sea-pines
    unitNumber: v.optional(v.string()),
    weekLabel: v.optional(v.string()),       // free text: real rows say "23 & 24", "Flexible"
    weekNumber: v.optional(v.number()),      // parsed when unambiguous, for filtering
    year: v.optional(v.number()),

    // for_sale
    askingPrice: v.optional(v.number()),     // owner sets their own price, no approval
    // trade
    desiredWeekLabel: v.optional(v.string()),
    desiredWeekNumber: v.optional(v.number()),
    desiredYear: v.optional(v.number()),

    notes: v.optional(v.string()),

    // Contact shown to other owners inside the gated portal
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),

    postedAt: v.number(),
    expiresAt: v.number(),            // postedAt + 1 year, matching the WordPress rule
    closedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_pool_status", ["pool", "status"])
    .index("by_owner", ["ownerProfileId"])
    .index("by_kind", ["kind"])
    .index("by_status", ["status"]),

  // ── Content: pages and blog posts ──
  // Scott's MVP item 2: "All the LeadWorks Intent basic functionality for
  // managing pages, blogs, SEO." Content is per-site (siteSlug) — the four
  // sister sites share one backend but never share marketing copy. This is
  // deliberately unlike marketplaceListings, which is pooled on purpose.
  // ── Newsletter ──
  // Backs the "Subscribe to Our Newsletter" block in the Heritage footer.
  // Scoped per site: a Spicebush signup is not a Heritage signup.
  newsletterSubscribers: defineTable({
    siteSlug: v.string(),
    email: v.string(),
    createdAt: v.number(),
    unsubscribedAt: v.optional(v.number()),
  })
    .index("by_site", ["siteSlug"])
    .index("by_site_email", ["siteSlug", "email"]),

  contentPages: defineTable({
    siteSlug: v.string(),
    slug: v.string(),                 // url path segment, unique per site
    // The site's home page. One per site, seeded, not creatable or deletable.
    // Its layout is designed in code, so only the title/SEO fields apply
    // [scott, 2026-09-10].
    isHome: v.optional(v.boolean()),
    // Editable copy and images for the code-designed home page layout
    // [scott, 2026-09-11 — "I need page editing functionality in this backend"].
    // Every field is optional: anything left unset falls back to the design
    // defaults in src/lib/homeContent.ts, so an empty record renders exactly
    // as the hand-built page did.
    homeContent: v.optional(
      v.object({
        hero: v.optional(
          v.object({
            eyebrow: v.optional(v.string()),
            headlineLines: v.optional(v.array(v.string())),
            intro: v.optional(v.string()),
            primaryLabel: v.optional(v.string()),
            primaryHref: v.optional(v.string()),
            secondaryLabel: v.optional(v.string()),
            secondaryHref: v.optional(v.string()),
            images: v.optional(v.array(v.string())),
          })
        ),
        tiles: v.optional(
          v.object({
            heading: v.optional(v.string()),
            subheading: v.optional(v.string()),
            items: v.optional(
              v.array(
                v.object({
                  label: v.string(),
                  imageUrl: v.optional(v.string()),
                  href: v.optional(v.string()),
                })
              )
            ),
          })
        ),
        map: v.optional(
          v.object({
            heading: v.optional(v.string()),
            intro: v.optional(v.string()),
          })
        ),
        communities: v.optional(
          v.object({
            heading: v.optional(v.string()),
            subheading: v.optional(v.string()),
          })
        ),
        featured: v.optional(
          v.object({
            heading: v.optional(v.string()),
            subheading: v.optional(v.string()),
          })
        ),
        closing: v.optional(
          v.object({
            enabled: v.optional(v.boolean()),
            heading: v.optional(v.string()),
            body: v.optional(v.string()),
            primaryLabel: v.optional(v.string()),
            primaryHref: v.optional(v.string()),
            secondaryLabel: v.optional(v.string()),
            secondaryHref: v.optional(v.string()),
          })
        ),
      })
    ),
    title: v.string(),
    body: v.string(),                 // markdown
    excerpt: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    showInNav: v.boolean(),
    navLabel: v.optional(v.string()), // defaults to title when absent
    sortOrder: v.optional(v.number()),
    seo: v.optional(v.object({
      metaTitle: v.optional(v.string()),
      metaDescription: v.optional(v.string()),
      ogImageUrl: v.optional(v.string()),
      canonicalUrl: v.optional(v.string()),
      noindex: v.optional(v.boolean()),
    })),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    updatedByName: v.optional(v.string()),
  })
    .index("by_site_slug", ["siteSlug", "slug"])
    .index("by_site_status", ["siteSlug", "status"])
    .index("by_site_nav", ["siteSlug", "showInNav"]),

  // ── Store: maintenance fees ──
  // Scott's store scope is maintenance fees only [scott, 2026-09-08], and the
  // store exists independently of any payment processor [scott, 2026-09-10]:
  // a $0 item is a valid item, and a fee can be recorded as paid by check
  // without Square being connected at all.
  storeItems: defineTable({
    siteSlug: v.string(),
    name: v.string(),                 // "2027 Annual Maintenance Fee"
    description: v.optional(v.string()),
    priceCents: v.number(),           // 0 is allowed and means free
    feeYear: v.optional(v.number()),  // the year the fee covers
    // Optional targeting: a fee can apply to one community only.
    communityId: v.optional(v.id("communities")),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    updatedByName: v.optional(v.string()),
  })
    .index("by_site", ["siteSlug"])
    .index("by_site_active", ["siteSlug", "isActive"]),

  storeCharges: defineTable({
    siteSlug: v.string(),
    itemId: v.optional(v.id("storeItems")),   // kept for reporting; may be removed later
    itemName: v.string(),                     // snapshot, so history survives item edits
    ownerProfileId: v.id("userProfiles"),
    weekId: v.optional(v.id("weeks")),        // which unit/week the fee covers
    weekLabel: v.optional(v.string()),        // snapshot for display
    amountCents: v.number(),
    feeYear: v.optional(v.number()),
    status: v.union(
      v.literal("due"),
      v.literal("paid"),
      v.literal("waived"),
      v.literal("refunded")
    ),
    // How it was settled. "external" = paid on the management company portal,
    // "manual" = check/phone recorded by staff, "square" = card on site.
    paymentMethod: v.optional(
      v.union(
        v.literal("square"),
        v.literal("manual"),
        v.literal("external"),
        v.literal("free")
      )
    ),
    paymentRef: v.optional(v.string()),
    dueDate: v.optional(v.string()),          // ISO date
    paidAt: v.optional(v.number()),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    updatedByName: v.optional(v.string()),
  })
    .index("by_site", ["siteSlug"])
    .index("by_owner", ["ownerProfileId"])
    .index("by_site_status", ["siteSlug", "status"]),

  blogPosts: defineTable({
    siteSlug: v.string(),
    slug: v.string(),
    title: v.string(),
    excerpt: v.optional(v.string()),
    body: v.string(),                 // markdown
    coverImageUrl: v.optional(v.string()),
    authorName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("published")),
    seo: v.optional(v.object({
      metaTitle: v.optional(v.string()),
      metaDescription: v.optional(v.string()),
      ogImageUrl: v.optional(v.string()),
      canonicalUrl: v.optional(v.string()),
      noindex: v.optional(v.boolean()),
    })),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    updatedByName: v.optional(v.string()),
  })
    .index("by_site_slug", ["siteSlug", "slug"])
    .index("by_site_status", ["siteSlug", "status"])
    .index("by_site_published", ["siteSlug", "publishedAt"]),

});

export default schema;
