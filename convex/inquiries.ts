import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const submit = mutation({
  args: {
    type: v.union(v.literal("purchase"), v.literal("rental")),
    propertyId: v.optional(v.id("properties")),
    weekId: v.optional(v.id("weeks")),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Determine routing
    const routedTo =
      args.type === "purchase"
        ? "lisafleming@lighthouserealtyhhi.com"
        : "asutton@cglhhi.com";

    const id = await ctx.db.insert("inquiries", {
      ...args,
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
    type: v.optional(v.union(v.literal("purchase"), v.literal("rental"))),
    status: v.optional(
      v.union(v.literal("new"), v.literal("contacted"), v.literal("closed"))
    ),
  },
  handler: async (ctx, { type, status }) => {
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
