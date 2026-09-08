import { v } from "convex/values";
import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Inquiry rows hold customer PII (name, email, phone, free-text message), so
// every read and write below the public `submit` is admin-gated. Mirrors the
// guard in convex/content.ts.
const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Admin access required");
  }
}

function formatPhone(value?: string): string | undefined {
  if (!value) return value;
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export const submit = mutation({
  args: {
    type: v.union(v.literal("purchase"), v.literal("rental"), v.literal("general")),
    siteSlug: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    weekId: v.optional(v.id("weeks")),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Determine routing
    // General contact-form enquiries go to the same Club Group address as
    // rentals until Scott confirms a dedicated inbox for them.
    const routedTo =
      args.type === "purchase"
        ? "lisafleming@lighthouserealtyhhi.com"
        : "asutton@cglhhi.com";

    const id = await ctx.db.insert("inquiries", {
      ...args,
      phone: formatPhone(args.phone),
      routedTo,
      status: "new",
      createdAt: Date.now(),
    });

    // TODO: Phase 2 — trigger email via Resend action
    return id;
  },
});

// Admin query
export const list = query({
  args: {
    type: v.optional(
      v.union(v.literal("purchase"), v.literal("rental"), v.literal("general"))
    ),
    status: v.optional(
      v.union(v.literal("new"), v.literal("contacted"), v.literal("closed"))
    ),
  },
  handler: async (ctx, { type, status }) => {
    await requireAdmin(ctx);
    let inquiries;
    if (type) {
      inquiries = await ctx.db
        .query("inquiries")
        .withIndex("by_type", (q) => q.eq("type", type))
        .collect();
    } else {
      inquiries = await ctx.db
        .query("inquiries")
        .withIndex("by_created")
        .order("desc")
        .collect();
    }

    if (status) {
      inquiries = inquiries.filter((i) => i.status === status);
    }

    // Resolve property names
    return Promise.all(
      inquiries.map(async (i) => {
        let propertyAddress = null;
        if (i.propertyId) {
          const property = await ctx.db.get(i.propertyId);
          propertyAddress = property?.address ?? null;
        }
        return { ...i, propertyAddress };
      })
    );
  },
});

/**
 * Permanently delete an inquiry. Used for spam and for test submissions;
 * there is no soft-delete because the row is pure PII and the client's
 * lawful basis for holding it ends when they discard it.
 */
export const remove = mutation({
  args: { id: v.id("inquiries") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return { deleted: true };
  },
});
