import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ── Helper: format phone to (xxx) xxx-xxxx ──
function formatPhone(value?: string): string | undefined {
  if (!value) return value;
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 10) return value; // return as-is if not 10 digits
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Helper: require admin (any admin role) ──
const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];
const SUPER_ADMIN_ROLES = ["admin"]; // Super Users only

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  // Look up by userId first
  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  // Fallback: look up by email (covers re-registration after auth reset)
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      const byEmail = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
      if (byEmail && ADMIN_ROLES.includes(byEmail.role)) {
        profile = byEmail;
      }
    }
  }

  if (!profile || !ADMIN_ROLES.includes(profile.role))
    throw new Error("Admin access required");
  return { userId, profile };
}

async function requireSuperAdmin(ctx: any) {
  const { userId, profile } = await requireAdmin(ctx);
  if (!SUPER_ADMIN_ROLES.includes(profile.role))
    throw new Error("Super User access required");
  return { userId, profile };
}

// ── Helper: check week-scoped permission ──
function requireWeekPermission(
  profile: { role: string },
  listingType: string | undefined
) {
  if (profile.role === "admin") return; // full admin can do anything
  const lt = listingType ?? "both";
  if (profile.role === "admin_rental") {
    if (lt === "sale") throw new Error("You can only manage rental weeks");
  }
  if (profile.role === "admin_sales") {
    if (lt === "rent") throw new Error("You can only manage sale weeks");
  }
}

// ── Dashboard Stats ──
export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const allProperties = await ctx.db.query("properties").collect();
    const activeProperties = allProperties.filter((p) => p.isActive);
    const featuredProperties = allProperties.filter((p) => p.isFeatured);
    const communities = await ctx.db.query("communities").collect();
    const allWeeks = await ctx.db.query("weeks").collect();
    const availableWeeks = allWeeks.filter((w) => w.status === "available");
    const RENTAL_TYPES = ["rent", "both"];
    const SALE_TYPES = ["sale", "both"];
    const availableRentalWeeks = availableWeeks.filter((w) =>
      RENTAL_TYPES.includes(w.listingType ?? "rent")
    );
    const availableSaleWeeks = availableWeeks.filter((w) =>
      SALE_TYPES.includes(w.listingType ?? "sale")
    );
    const inquiries = await ctx.db.query("inquiries").collect();
    const newInquiries = inquiries.filter((i) => i.status === "new");

    return {
      totalProperties: allProperties.length,
      activeProperties: activeProperties.length,
      featuredProperties: featuredProperties.length,
      totalCommunities: communities.length,
      totalWeeks: allWeeks.length,
      availableWeeks: availableWeeks.length,
      availableRentalWeeks: availableRentalWeeks.length,
      availableSaleWeeks: availableSaleWeeks.length,
      totalInquiries: inquiries.length,
      newInquiries: newInquiries.length,
      recentInquiries: inquiries
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map((inq) => ({
          ...inq,
        })),
    };
  },
});

// ── Current user info ──
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Look up by userId first
    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    // Fallback: look up by email (covers re-registration after auth reset)
    if (!profile) {
      const authUser = await ctx.db.get(userId);
      if (authUser?.email) {
        const byEmail = await ctx.db
          .query("userProfiles")
          .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
          .first();
        if (byEmail && ADMIN_ROLES.includes(byEmail.role)) {
          profile = byEmail;
        }
      }
    }

    let avatarUrl: string | null = null;
    if (profile?.avatarStorageId) {
      avatarUrl = await ctx.storage.getUrl(profile.avatarStorageId);
    }
    return {
      userId,
      profile,
      avatarUrl,
      isSuperUser: profile ? SUPER_ADMIN_ROLES.includes(profile.role) : false,
    };
  },
});

// ── Properties: List all (admin) ──
export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const properties = await ctx.db.query("properties").collect();
    const communities = await ctx.db.query("communities").collect();
    const communityMap = new Map(communities.map((c) => [c._id, c]));

    return properties
      .sort((a, b) => {
        const ca = communityMap.get(a.communityId)?.name ?? "";
        const cb = communityMap.get(b.communityId)?.name ?? "";
        if (ca !== cb) return ca.localeCompare(cb);
        return a.address.localeCompare(b.address);
      })
      .map((p) => ({
        ...p,
        communityName: communityMap.get(p.communityId)?.name ?? "Unknown",
        communitySlug: communityMap.get(p.communityId)?.slug ?? "",
      }));
  },
});

// ── Properties: Get single ──
export const getProperty = query({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const property = await ctx.db.get(id);
    if (!property) return null;
    const community = await ctx.db.get(property.communityId);
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q: any) => q.eq("propertyId", id))
      .collect();
    const photos = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", id))
      .collect();
    return {
      ...property,
      communityName: community?.name ?? "Unknown",
      communitySlug: community?.slug ?? "",
      weeks: weeks.sort((a, b) => a.weekNumber - b.weekNumber),
      photos: photos.sort((a, b) => a.sortOrder - b.sortOrder),
    };
  },
});

// ── Properties: Create ──
export const createProperty = mutation({
  args: {
    address: v.string(),
    unitNumber: v.string(),
    communityId: v.id("communities"),
    bedrooms: v.number(),
    bathrooms: v.number(),
    sleeps: v.optional(v.number()),
    squareFeet: v.optional(v.number()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    isFeatured: v.optional(v.boolean()),
    bookingUrl: v.optional(v.string()),
    calendarUrl: v.optional(v.string()),
    ownerDocsUrl: v.optional(v.string()),
    houseRules: v.optional(v.string()),
    cancellationPolicy: v.optional(v.string()),
    checkInInfo: v.optional(v.string()),
    // Rental details (Hostaway)
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
    await requireAdmin(ctx);
    const slug = args.address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const id = await ctx.db.insert("properties", {
      ...args,
      slug,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});

// ── Properties: Update ──
export const updateProperty = mutation({
  args: {
    id: v.id("properties"),
    address: v.optional(v.string()),
    unitNumber: v.optional(v.string()),
    communityId: v.optional(v.id("communities")),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    sleeps: v.optional(v.number()),
    squareFeet: v.optional(v.number()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    bookingUrl: v.optional(v.string()),
    calendarUrl: v.optional(v.string()),
    ownerDocsUrl: v.optional(v.string()),
    houseRules: v.optional(v.string()),
    cancellationPolicy: v.optional(v.string()),
    checkInInfo: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    // Rental details (Hostaway)
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
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Property not found");
    const updates: any = { ...fields, updatedAt: Date.now() };
    if (fields.address) {
      updates.slug = fields.address
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    // Remove undefined values
    Object.keys(updates).forEach((k) => {
      if (updates[k] === undefined) delete updates[k];
    });
    await ctx.db.patch(id, updates);
  },
});

// ── Properties: Delete ──
export const deleteProperty = mutation({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    // Delete associated weeks
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_property", (q: any) => q.eq("propertyId", id))
      .collect();
    for (const w of weeks) await ctx.db.delete(w._id);
    // Delete associated photos
    const photos = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", id))
      .collect();
    for (const p of photos) await ctx.db.delete(p._id);
    await ctx.db.delete(id);
  },
});

// ── Properties: Toggle active/featured ──
export const togglePropertyFlag = mutation({
  args: {
    id: v.id("properties"),
    field: v.union(v.literal("isActive"), v.literal("isFeatured")),
  },
  handler: async (ctx, { id, field }) => {
    await requireAdmin(ctx);
    const property = await ctx.db.get(id);
    if (!property) throw new Error("Property not found");
    await ctx.db.patch(id, {
      [field]: !property[field],
      updatedAt: Date.now(),
    });
  },
});

// ── Communities: List all ──
export const listCommunities = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const communities = await ctx.db.query("communities").collect();
    // Count properties per community
    const properties = await ctx.db.query("properties").collect();
    const counts = new Map<string, number>();
    properties.forEach((p) => {
      counts.set(p.communityId, (counts.get(p.communityId) ?? 0) + 1);
    });
    return communities
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
      .map((c) => ({
        ...c,
        propertyCount: counts.get(c._id) ?? 0,
      }));
  },
});

// ── Communities: Update ──
export const updateCommunity = mutation({
  args: {
    id: v.id("communities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    features: v.optional(v.record(v.string(), v.string())),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const updates: any = { ...fields };
    if (fields.name) {
      updates.slug = fields.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    Object.keys(updates).forEach((k) => {
      if (updates[k] === undefined) delete updates[k];
    });
    await ctx.db.patch(id, updates);
  },
});

// ── Weeks: List by property ──
export const listWeeksByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("weeks")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect()
      .then((weeks) => weeks.sort((a, b) => a.weekNumber - b.weekNumber));
  },
});

// ── Weeks: Create ──
export const createWeek = mutation({
  args: {
    propertyId: v.id("properties"),
    weekNumber: v.number(),
    listingType: v.optional(
      v.union(v.literal("rent"), v.literal("sale"), v.literal("both"))
    ),
    price: v.optional(v.number()),
    rentPrice: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("pending"),
      v.literal("sold"),
      v.literal("rented"),
      v.literal("not_listed")
    ),
    year: v.optional(v.number()),
    isAnnual: v.optional(v.boolean()),
    airbnbCalendarUrl: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("userProfiles"), v.null())),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    requireWeekPermission(profile, args.listingType);
    const { ownerId, ...rest } = args;
    const insertData: any = { ...rest, createdAt: Date.now(), updatedAt: Date.now() };
    if (ownerId) insertData.ownerId = ownerId;
    return await ctx.db.insert("weeks", insertData);
  },
});

// ── Weeks: Update ──
export const updateWeek = mutation({
  args: {
    id: v.id("weeks"),
    weekNumber: v.optional(v.number()),
    listingType: v.optional(
      v.union(v.literal("rent"), v.literal("sale"), v.literal("both"))
    ),
    price: v.optional(v.number()),
    rentPrice: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("available"),
        v.literal("pending"),
        v.literal("sold"),
        v.literal("rented"),
        v.literal("not_listed")
      )
    ),
    year: v.optional(v.number()),
    isAnnual: v.optional(v.boolean()),
    airbnbCalendarUrl: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("userProfiles"), v.null())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const { profile } = await requireAdmin(ctx);
    // Check permission against both old and new listing type
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Week not found");
    requireWeekPermission(profile, existing.listingType);
    if (fields.listingType) requireWeekPermission(profile, fields.listingType);
    const updates: any = { ...fields, updatedAt: Date.now() };
    Object.keys(updates).forEach((k) => {
      if (updates[k] === undefined) delete updates[k];
    });
    await ctx.db.patch(id, updates);
  },
});

// ── Weeks: Delete ──
export const deleteWeek = mutation({
  args: { id: v.id("weeks") },
  handler: async (ctx, { id }) => {
    const { profile } = await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Week not found");
    requireWeekPermission(profile, existing.listingType);
    await ctx.db.delete(id);
  },
});

// ── Inquiries: List all ──
export const listInquiries = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const inquiries = await ctx.db.query("inquiries").collect();
    // Enrich with property info
    const enriched = await Promise.all(
      inquiries.map(async (inq) => {
        let propertyAddress = "";
        let communityName = "";
        if (inq.propertyId) {
          const prop = await ctx.db.get(inq.propertyId);
          if (prop) {
            propertyAddress = prop.address;
            const comm = await ctx.db.get(prop.communityId);
            communityName = comm?.name ?? "";
          }
        }
        return { ...inq, propertyAddress, communityName };
      })
    );
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── Inquiries: Update status ──
export const updateInquiryStatus = mutation({
  args: {
    id: v.id("inquiries"),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("closed")
    ),
  },
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx);
    const updates: any = { status };
    if (status === "contacted") updates.respondedAt = Date.now();
    await ctx.db.patch(id, updates);
  },
});

// ── Setup: Create initial admin user profile ──
export const setupAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check by userId first
    const byUserId = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();
    if (byUserId && ADMIN_ROLES.includes(byUserId.role)) return byUserId._id;

    // Fallback: check by email (re-registration after auth reset)
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      const byEmail = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
      if (byEmail && ADMIN_ROLES.includes(byEmail.role)) {
        await ctx.db.patch(byEmail._id, { userId });
        return byEmail._id;
      }
    }

    // Check if any admin exists — if so, reject new bootstraps
    const existingAdmin = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q: any) => q.eq("role", "admin"))
      .first();
    if (existingAdmin) {
      throw new Error("Admin already exists");
    }

    // First-user bootstrap
    return await ctx.db.insert("userProfiles", {
      userId,
      role: "admin",
      createdAt: Date.now(),
    });
  },
});

// ── Photo management ──
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addPropertyPhoto = mutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, { propertyId, storageId, caption, isPrimary }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect();
    const sortOrder = existing.length;
    // If marking as primary, unset other primaries
    if (isPrimary) {
      for (const p of existing) {
        if (p.isPrimary) await ctx.db.patch(p._id, { isPrimary: false });
      }
    }
    return await ctx.db.insert("propertyPhotos", {
      propertyId,
      storageId,
      caption,
      sortOrder,
      isPrimary: isPrimary ?? existing.length === 0,
    });
  },
});

export const deletePropertyPhoto = mutation({
  args: { id: v.id("propertyPhotos") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});

export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

// ── Admin: Invite / set role ──
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("userProfiles").collect();
  },
});

export const setUserRole = mutation({
  args: {
    profileId: v.id("userProfiles"),
    role: v.union(
      v.literal("admin"),
      v.literal("admin_rental"),
      v.literal("admin_sales"),
      v.literal("owner"),
      v.literal("renter")
    ),
  },
  handler: async (ctx, { profileId, role }) => {
    const { profile } = await requireAdmin(ctx);
    // Only full admins can change roles
    if (profile.role !== "admin") throw new Error("Only full admins can manage roles");
    await ctx.db.patch(profileId, { role });
  },
});

// ── Sale Requests: List all ──
export const listSaleRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db.query("saleRequests").collect();
    return await Promise.all(
      requests
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (r) => {
          const property = await ctx.db.get(r.propertyId);
          // ownerId now references userProfiles directly
          const ownerProfile = await ctx.db.get(r.ownerId);
          return {
            ...r,
            propertyAddress: property?.address ?? "Unknown",
            ownerName:
              ownerProfile?.displayName ?? ownerProfile?.email ?? "Unknown",
          };
        })
    );
  },
});

// ── Sale Requests: Approve / Reject ──
export const reviewSaleRequest = mutation({
  args: {
    requestId: v.id("saleRequests"),
    action: v.union(v.literal("approved"), v.literal("rejected")),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, action, adminNotes }) => {
    await requireAdmin(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending")
      throw new Error("Only pending requests can be reviewed");

    const updates: any = {
      status: action,
      adminNotes,
      updatedAt: Date.now(),
    };

    // If approved, update the existing week with the sale price
    if (action === "approved") {
      const week = await ctx.db.get(request.weekId);
      if (week) {
        await ctx.db.patch(week._id, {
          listingType: "sale",
          price: request.askingPrice,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(requestId, updates);
  },
});

export const promoteToAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await requireAdmin(ctx);
    const profiles = await ctx.db.query("userProfiles").collect();
    const match = profiles.find((p: any) => p.email === email);
    if (match) {
      await ctx.db.patch(match._id, { role: "admin" });
      return match._id;
    }
    return await ctx.db.insert("userProfiles", {
      role: "admin",
      email,
      createdAt: Date.now(),
    });
  },
});

// ═══════════════════════════════════════════════
// ── Owner Management ──
// ═══════════════════════════════════════════════

// ── List all owners ──
export const listOwners = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const owners = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q: any) => q.eq("role", "owner"))
      .collect();

    // Enrich each owner with properties via week-level ownership
    return await Promise.all(
      owners
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (owner) => {
          const ownedWeeks = await ctx.db
            .query("weeks")
            .withIndex("by_owner", (q: any) => q.eq("ownerId", owner._id))
            .collect();
          const propertyIds = [...new Set(ownedWeeks.map((w: any) => String(w.propertyId)))];
          const properties = (await Promise.all(
            propertyIds.map((id) => ctx.db.get(id as any))
          )).filter(Boolean) as any[];

          return {
            ...owner,
            fullName: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.displayName || owner.email || "—",
            propertyCount: properties.length,
            weekCount: ownedWeeks.length,
            properties: properties.map((p: any) => ({
              _id: p._id,
              address: p.address,
            })),
            isLinked: !!owner.userId,
          };
        })
    );
  },
});

// ── Get single owner detail ──
export const getOwner = query({
  args: { ownerId: v.id("userProfiles") },
  handler: async (ctx, { ownerId }) => {
    await requireAdmin(ctx);
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.role !== "owner") throw new Error("Owner not found");

    // Get assigned properties via week-level ownership
    const ownedWeeks = await ctx.db
      .query("weeks")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", ownerId))
      .collect();
    const propertyIds = [...new Set(ownedWeeks.map((w: any) => String(w.propertyId)))];
    const properties = (await Promise.all(
      propertyIds.map((id) => ctx.db.get(id as any))
    )).filter(Boolean) as any[];

    // Enrich properties with community name + owned week count
    const enrichedProperties = await Promise.all(
      properties.map(async (p: any) => {
        const community = await ctx.db.get(p.communityId);
        const weeksForProp = ownedWeeks.filter(
          (w: any) => String(w.propertyId) === String(p._id)
        );
        return {
          _id: p._id,
          address: p.address,
          slug: p.slug,
          communityName: community?.name ?? "Unknown",
          isActive: p.isActive,
          ownedWeekCount: weeksForProp.length,
        };
      })
    );

    return {
      ...owner,
      fullName: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.displayName || "—",
      isLinked: !!owner.userId,
      properties: enrichedProperties,
    };
  },
});

// ── Create owner ──
export const createOwner = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    homeState: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
    homePostalCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check for duplicate email
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();
    if (existing) throw new Error("An account with this email already exists");

    return await ctx.db.insert("userProfiles", {
      role: "owner",
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: formatPhone(args.phone),
      homeAddress: args.homeAddress,
      homeCity: args.homeCity,
      homeState: args.homeState,
      homeCountry: args.homeCountry,
      homePostalCode: args.homePostalCode,
      displayName: `${args.firstName} ${args.lastName}`,
      createdAt: Date.now(),
    });
  },
});

// ── Update owner ──
export const updateOwner = mutation({
  args: {
    ownerId: v.id("userProfiles"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    homeState: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
    homePostalCode: v.optional(v.string()),
  },
  handler: async (ctx, { ownerId, ...args }) => {
    await requireAdmin(ctx);
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.role !== "owner") throw new Error("Owner not found");

    // Check duplicate email (exclude self)
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();
    if (existing && existing._id !== ownerId) {
      throw new Error("An account with this email already exists");
    }

    await ctx.db.patch(ownerId, {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: formatPhone(args.phone),
      homeAddress: args.homeAddress,
      homeCity: args.homeCity,
      homeState: args.homeState,
      homeCountry: args.homeCountry,
      homePostalCode: args.homePostalCode,
      displayName: `${args.firstName} ${args.lastName}`,
    });
  },
});

// ── Delete owner ──
export const deleteOwner = mutation({
  args: { ownerId: v.id("userProfiles") },
  handler: async (ctx, { ownerId }) => {
    await requireAdmin(ctx);
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.role !== "owner") throw new Error("Owner not found");

    // Unassign any properties
    if (owner.userId) {
      const properties = await ctx.db
        .query("properties")
        .withIndex("by_owner", (q: any) => q.eq("ownerId", owner.userId))
        .collect();
      for (const p of properties) {
        await ctx.db.patch(p._id, { ownerId: undefined });
      }
    }

    await ctx.db.delete(ownerId);
  },
});

// ── Search owners (for property assign dropdown) ──
export const searchOwners = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireAdmin(ctx);
    const owners = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q: any) => q.eq("role", "owner"))
      .collect();

    const term = (search ?? "").toLowerCase().trim();
    const filtered = term
      ? owners.filter((o) => {
          const name = [o.firstName, o.lastName, o.displayName, o.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return name.includes(term);
        })
      : owners;

    return filtered.map((o) => ({
      _id: o._id,
      userId: o.userId,
      fullName: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.displayName || o.email || "—",
      email: o.email,
    }));
  },
});

// ── Reset owner password (generates token for password reset) ──
export const resetOwnerPassword = mutation({
  args: { ownerId: v.id("userProfiles") },
  handler: async (ctx, { ownerId }) => {
    await requireAdmin(ctx);
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.role !== "owner") throw new Error("Owner not found");
    if (!owner.userId) throw new Error("Owner has not registered yet — send welcome letter instead");

    // Delete existing auth sessions for this user to force re-login
    const sessions = await ctx.db
      .query("authSessions")
      .collect();
    for (const s of sessions) {
      if ((s as any).userId === owner.userId) {
        await ctx.db.delete(s._id);
      }
    }

    // Delete existing auth accounts (password) so they can re-register
    const accounts = await ctx.db.query("authAccounts").collect();
    for (const a of accounts) {
      if ((a as any).userId === owner.userId && (a as any).provider === "password") {
        await ctx.db.delete(a._id);
      }
    }

    // Unlink the userId so they go through the signup flow again
    await ctx.db.patch(ownerId, { userId: undefined });

    return { success: true, email: owner.email };
  },
});

// ═══════════════════════════════════════════════
// ── My Account (any admin) ──
// ═══════════════════════════════════════════════

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireAdmin(ctx);
    let avatarUrl: string | null = null;
    if (profile.avatarStorageId) {
      avatarUrl = await ctx.storage.getUrl(profile.avatarStorageId);
    }
    return {
      ...profile,
      avatarUrl,
      isSuperUser: SUPER_ADMIN_ROLES.includes(profile.role),
      roleLabel: profile.role === "admin" ? "Super User" : "User",
    };
  },
});

export const updateMyProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    const updates: any = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = formatPhone(args.phone);
    if (args.avatarStorageId !== undefined) {
      if (args.avatarStorageId === null) {
        updates.avatarStorageId = undefined;
      } else {
        updates.avatarStorageId = args.avatarStorageId;
      }
    }
    // Update displayName
    const fn = args.firstName ?? profile.firstName ?? "";
    const ln = args.lastName ?? profile.lastName ?? "";
    if (fn || ln) updates.displayName = [fn, ln].filter(Boolean).join(" ");
    await ctx.db.patch(profile._id, updates);
  },
});

// ═══════════════════════════════════════════════
// ── Admin User Management (Super User only) ──
// ═══════════════════════════════════════════════

export const listAdminUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const allProfiles = await ctx.db.query("userProfiles").collect();
    const admins = allProfiles.filter((p: any) => ADMIN_ROLES.includes(p.role));
    return admins.map((p: any) => ({
      _id: p._id,
      userId: p.userId,
      displayName: p.displayName ?? [p.firstName, p.lastName].filter(Boolean).join(" ") ?? p.email ?? "—",
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      role: p.role,
      roleLabel: p.role === "admin" ? "Super User" : "User",
      isSuperUser: SUPER_ADMIN_ROLES.includes(p.role),
      isLinked: !!p.userId,
      createdAt: p.createdAt,
    }));
  },
});

export const createAdminUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    isSuperUser: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    // Check duplicate email
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();
    if (existing) throw new Error("An account with this email already exists");

    return await ctx.db.insert("userProfiles", {
      role: args.isSuperUser ? "admin" : "admin_user",
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: formatPhone(args.phone),
      displayName: `${args.firstName} ${args.lastName}`,
      createdAt: Date.now(),
    });
  },
});

export const updateAdminUser = mutation({
  args: {
    profileId: v.id("userProfiles"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isSuperUser: v.optional(v.boolean()),
  },
  handler: async (ctx, { profileId, isSuperUser, ...args }) => {
    const { profile: myProfile } = await requireSuperAdmin(ctx);
    const target = await ctx.db.get(profileId);
    if (!target || !ADMIN_ROLES.includes(target.role))
      throw new Error("Admin user not found");

    const updates: any = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = formatPhone(args.phone);
    if (isSuperUser !== undefined) {
      // Don't allow demoting yourself
      if (target._id === myProfile._id && !isSuperUser) {
        throw new Error("You cannot demote yourself");
      }
      updates.role = isSuperUser ? "admin" : "admin_user";
    }
    // Update displayName
    const fn = args.firstName ?? target.firstName ?? "";
    const ln = args.lastName ?? target.lastName ?? "";
    if (fn || ln) updates.displayName = [fn, ln].filter(Boolean).join(" ");
    await ctx.db.patch(profileId, updates);
  },
});

export const deleteAdminUser = mutation({
  args: { profileId: v.id("userProfiles") },
  handler: async (ctx, { profileId }) => {
    const { profile: myProfile } = await requireSuperAdmin(ctx);
    if (profileId === myProfile._id) throw new Error("You cannot delete yourself");
    const target = await ctx.db.get(profileId);
    if (!target || !ADMIN_ROLES.includes(target.role))
      throw new Error("Admin user not found");
    await ctx.db.delete(profileId);
  },
});
