import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ── Helper: require owner role ──
async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  // Check by userId first
  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  // Fallback: check by email for pre-registered owners
  if (!profile || profile.role !== "owner") {
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      const byEmail = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
      if (byEmail && byEmail.role === "owner") {
        profile = byEmail;
      }
    }
  }
  if (!profile || profile.role !== "owner")
    throw new Error("Owner access required");
  return { userId, profile };
}

// ── Current user (returns null if not logged in or not owner — never throws) ──
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // First: check by userId (normal flow)
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();
    if (profile && profile.role === "owner") {
      // Resolve the avatar to a URL here so every surface that already reads
      // currentUser (header, listing cards) picks up the photo for free.
      const avatarUrl = profile.avatarStorageId
        ? await ctx.storage.getUrl(profile.avatarStorageId)
        : null;
      return { ...profile, avatarUrl, needsLink: false };
    }

    // Second: check by email (pre-registered owner who just signed up)
    const authUser = await ctx.db.get(userId);
    const email = authUser?.email;
    if (email) {
      const unlinkedProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .first();
      if (
        unlinkedProfile &&
        unlinkedProfile.role === "owner" &&
        !unlinkedProfile.userId
      ) {
        return { ...unlinkedProfile, needsLink: true };
      }
    }

    return null;
  },
});

// ── Claim/link a pre-registered profile to the logged-in user ──
export const claimProfile = mutation({
  args: { profileId: v.id("userProfiles") },
  handler: async (ctx, { profileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");
    if (profile.role !== "owner") throw new Error("Not an owner profile");
    if (profile.userId) throw new Error("Profile already linked");

    // Verify email match
    const authUser = await ctx.db.get(userId);
    if (!authUser?.email || authUser.email !== profile.email) {
      throw new Error("Email mismatch");
    }

    await ctx.db.patch(profileId, { userId });
    return { success: true };
  },
});

// ── Dashboard stats ──
export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireOwner(ctx);

    // Find weeks owned by this owner (week-level ownership)
    const ownedWeeks = await ctx.db
      .query("weeks")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
      .collect();

    // Unique properties from owned weeks
    const propertyIds = [
      ...new Set(ownedWeeks.map((w: any) => String(w.propertyId))),
    ];

    // Sale requests for this owner
    const saleRequests = await ctx.db
      .query("saleRequests")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
      .collect();
    const pendingRequests = saleRequests.filter(
      (r: any) => r.status === "pending",
    );
    const approvedRequests = saleRequests.filter(
      (r: any) => r.status === "approved",
    );

    // Inquiries for owned properties
    const propertyIdSet = new Set(propertyIds);
    const allInquiries = await ctx.db.query("inquiries").collect();
    const myInquiries = allInquiries.filter(
      (inq: any) => inq.propertyId && propertyIdSet.has(String(inq.propertyId)),
    );
    const newInquiries = myInquiries.filter((inq: any) => inq.status === "new");

    return {
      ownedWeeks: ownedWeeks.length,
      propertyCount: propertyIds.length,
      listedForSale: approvedRequests.length,
      pendingRequests: pendingRequests.length,
      totalRequests: saleRequests.length,
      inquiryCount: myInquiries.length,
      newInquiryCount: newInquiries.length,
    };
  },
});

// ── List all owned weeks with property info + sale request status ──
export const listOwnedWeeks = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireOwner(ctx);

    const ownedWeeks = await ctx.db
      .query("weeks")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
      .collect();

    // Sort by property address then week number
    const results = await Promise.all(
      ownedWeeks.map(async (week: any) => {
        const property = await ctx.db.get(week.propertyId);
        const community = property
          ? await ctx.db.get(property.communityId)
          : null;

        // Get active sale request for this week (pending or approved)
        const saleRequests = await ctx.db
          .query("saleRequests")
          .withIndex("by_week", (q: any) => q.eq("weekId", week._id))
          .collect();
        const activeSaleRequest =
          saleRequests
            .filter(
              (r: any) => r.status === "pending" || r.status === "approved",
            )
            .sort((a: any, b: any) => b.createdAt - a.createdAt)[0] ?? null;

        // Photo
        let photoUrl: string | null = null;
        if (property) {
          const photoRecords = await ctx.db
            .query("propertyPhotos")
            .withIndex("by_property", (q: any) =>
              q.eq("propertyId", property._id),
            )
            .collect();
          const primary =
            photoRecords.find((p: any) => p.isPrimary) ?? photoRecords[0];
          if (primary?.storageId) {
            photoUrl = await ctx.storage.getUrl(primary.storageId);
          } else if (primary?.externalUrl) {
            photoUrl = primary.externalUrl;
          } else if (property?.photoUrls?.[0]) {
            photoUrl = property.photoUrls[0];
          }
        }

        return {
          weekId: week._id,
          weekNumber: week.weekNumber,
          year: week.year ?? 2026,
          propertyId: week.propertyId,
          propertyAddress: property?.address ?? "Unknown",
          propertySlug: property?.slug,
          // Needed by the listing form: a listing is identified by unit +
          // week, and the ownership check on the server matches on both.
          unitNumber: property?.unitNumber,
          communityName: community?.name ?? "Unknown",
          communitySlug: (community as any)?.slug ?? null,
          bedrooms: property?.bedrooms,
          bathrooms: property?.bathrooms,
          photoUrl,
          saleRequest: activeSaleRequest
            ? {
                _id: activeSaleRequest._id,
                status: activeSaleRequest.status,
                askingPrice: activeSaleRequest.askingPrice,
                notes: activeSaleRequest.notes,
                adminNotes: activeSaleRequest.adminNotes,
                createdAt: activeSaleRequest.createdAt,
              }
            : null,
        };
      }),
    );

    return results.sort((a, b) => {
      const addrCmp = a.propertyAddress.localeCompare(b.propertyAddress);
      if (addrCmp !== 0) return addrCmp;
      return a.weekNumber - b.weekNumber;
    });
  },
});

// ── Submit "Sell My Week" request (tied to specific week) ──
export const submitSaleRequest = mutation({
  args: {
    weekId: v.id("weeks"),
    askingPrice: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);

    // Verify the week is owned by this owner
    const week = await ctx.db.get(args.weekId);
    if (!week) throw new Error("Week not found");
    if (String(week.ownerId) !== String(profile._id))
      throw new Error("You do not own this week");

    // Check no active request already exists
    const existing = await ctx.db
      .query("saleRequests")
      .withIndex("by_week", (q: any) => q.eq("weekId", args.weekId))
      .collect();
    const activeRequest = existing.find(
      (r: any) => r.status === "pending" || r.status === "approved",
    );
    if (activeRequest)
      throw new Error("A sale request already exists for this week");

    const requestId = await ctx.db.insert("saleRequests", {
      weekId: args.weekId,
      propertyId: week.propertyId,
      ownerId: profile._id,
      weekNumber: week.weekNumber,
      askingPrice: args.askingPrice,
      notes: args.notes,
      status: "pending",
      createdAt: Date.now(),
    });

    // A request nobody is told about is a request nobody acts on: it used to
    // sit in the database with no admin screen and no alert [scott,
    // 2026-09-13]. The screen exists now; this is the nudge.
    const property: any = await ctx.db.get(week.propertyId);
    await ctx.scheduler.runAfter(0, internal.inquiries.notify, {
      inquiryId: String(requestId),
      routedTo: "asutton@cglhhi.com",
      type: "sale_request",
      name:
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.displayName ||
        profile.email ||
        "Owner",
      email: profile.email ?? "",
      message: [
        `${property?.address ?? "Unknown"} — Week ${week.weekNumber}`,
        args.askingPrice > 0
          ? `Asking: $${args.askingPrice.toLocaleString()}`
          : "Asking: contact for price",
        args.notes ? `Notes: ${args.notes}` : "",
        "Review it under Sale Requests in the management portal.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return requestId;
  },
});

// ── Edit an existing sale request ──
/**
 * Owners could withdraw a listing but not correct it, so fixing a typo in the
 * price meant withdrawing and starting over [scott, 2026-09-13].
 *
 * Status is deliberately left alone. An owner sets their own price without
 * broker approval, so a price change does not send an approved listing back to
 * the queue — it would take a live listing down over an edit.
 */
export const updateSaleRequest = mutation({
  args: {
    requestId: v.id("saleRequests"),
    askingPrice: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (String(request.ownerId) !== String(profile._id))
      throw new Error("You can only edit your own listings");
    if (request.status !== "pending" && request.status !== "approved")
      throw new Error("This listing can no longer be edited");
    if (args.askingPrice < 0)
      throw new Error("Asking price cannot be negative");

    await ctx.db.patch(args.requestId, {
      askingPrice: args.askingPrice,
      notes: args.notes,
      updatedAt: Date.now(),
    });
    // A price change on an approved listing must reach the marketplace copy.
    await ctx.scheduler.runAfter(
      0,
      internal.marketplace.syncListingForSaleRequest,
      { requestId: args.requestId },
    );
    return args.requestId;
  },
});

// ── Withdraw/cancel a sale request (pending or approved) ──
export const withdrawSaleRequest = mutation({
  args: { requestId: v.id("saleRequests") },
  handler: async (ctx, { requestId }) => {
    const { profile } = await requireOwner(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");
    if (String(request.ownerId) !== String(profile._id))
      throw new Error("Not your request");
    if (request.status !== "pending" && request.status !== "approved")
      throw new Error("Can only withdraw pending or approved requests");
    await ctx.db.patch(requestId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    // Withdrawing has to pull the week out of the marketplace too, or the
    // owner sees it gone from My Weeks while other owners still see it listed.
    await ctx.scheduler.runAfter(
      0,
      internal.marketplace.syncListingForSaleRequest,
      { requestId },
    );
  },
});

// ── List sale requests for this owner ──
export const listSaleRequests = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireOwner(ctx);
    const requests = await ctx.db
      .query("saleRequests")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
      .collect();

    return await Promise.all(
      requests
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .map(async (r: any) => {
          const property = await ctx.db.get(r.propertyId);
          return {
            ...r,
            propertyAddress: property?.address ?? "Unknown",
          };
        }),
    );
  },
});

// ── List inquiries for owner's properties (via week-level ownership) ──
export const listInquiries = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireOwner(ctx);

    // Find properties via week-level ownership
    const ownedWeeks = await ctx.db
      .query("weeks")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
      .collect();
    const propertyIds = [
      ...new Set(ownedWeeks.map((w: any) => String(w.propertyId))),
    ];
    const propertyIdSet = new Set(propertyIds);

    // Build property map
    const properties = (
      await Promise.all(propertyIds.map((id) => ctx.db.get(id as any)))
    ).filter(Boolean) as any[];
    const propertyMap = new Map(properties.map((p: any) => [String(p._id), p]));

    const allInquiries = await ctx.db.query("inquiries").collect();
    return allInquiries
      .filter(
        (inq: any) =>
          inq.propertyId && propertyIdSet.has(String(inq.propertyId)),
      )
      .sort((a: any, b: any) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .map((inq: any) => ({
        ...inq,
        propertyAddress:
          propertyMap.get(String(inq.propertyId))?.address ?? "Unknown",
      }));
  },
});

// ── Update inquiry status ──
export const updateInquiryStatus = mutation({
  args: {
    inquiryId: v.id("inquiries"),
    // The portal says "Responded"; the table says "contacted". Both are
    // accepted here and normalised below — this mutation used to write
    // "responded" straight through, which the schema rejects, so Mark
    // Responded failed every time it was clicked [found 2026-09-13].
    status: v.union(
      v.literal("new"),
      v.literal("responded"),
      v.literal("contacted"),
      v.literal("closed"),
    ),
    ownerNotes: v.optional(v.string()),
  },
  handler: async (ctx, { inquiryId, status, ownerNotes }) => {
    const { profile } = await requireOwner(ctx);
    const inquiry = await ctx.db.get(inquiryId);
    if (!inquiry) throw new Error("Inquiry not found");

    // Verify ownership via weeks
    if (inquiry.propertyId) {
      const ownedWeeks = await ctx.db
        .query("weeks")
        .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
        .collect();
      const ownsProperty = ownedWeeks.some(
        (w: any) => String(w.propertyId) === String(inquiry.propertyId),
      );
      if (!ownsProperty) throw new Error("Not your inquiry");
    }

    const stored = status === "responded" ? "contacted" : status;
    const updates: any = { status: stored };
    // `inquiries` has respondedAt, not updatedAt; writing updatedAt was the
    // second reason this mutation failed.
    if (stored === "contacted") updates.respondedAt = Date.now();
    if (ownerNotes !== undefined) updates.ownerNotes = ownerNotes;
    await ctx.db.patch(inquiryId, updates);
  },
});
