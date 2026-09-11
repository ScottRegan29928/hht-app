import { v } from "convex/values";
import {
  mutation,
  query,
  internalAction,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

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
    type: v.union(
      v.literal("purchase"),
      v.literal("rental"),
      v.literal("general"),
      // Owner-portal comment card; routed to the resort regime managers.
      v.literal("comment_card")
    ),
    siteSlug: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    weekId: v.optional(v.id("weeks")),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Routing: "For now send all submissions to asutton" [scott, 2026-09-08].
    // This deliberately includes purchase inquiries, which previously went to
    // lisafleming@lighthouserealtyhhi.com. Restore the per-type split when the
    // client confirms the real destinations.
    let routedTo = "asutton@cglhhi.com";

    // Comment cards are resort operations, not sales: the printed card tells
    // owners to email the resort regime address, so keep that destination.
    if (args.type === "comment_card" && args.siteSlug) {
      const settings = await ctx.db
        .query("ownerPortalSettings")
        .withIndex("by_site", (q) => q.eq("siteSlug", args.siteSlug!))
        .first();
      if (settings?.regimeEmail) routedTo = settings.regimeEmail;
    }

    const id = await ctx.db.insert("inquiries", {
      ...args,
      phone: formatPhone(args.phone),
      routedTo,
      status: "new",
      createdAt: Date.now(),
    });

    // Notify by email. A form submission that only lands in a table nobody
    // watches is the same as a form that does not work.
    await ctx.scheduler.runAfter(0, internal.inquiries.notify, {
      inquiryId: id,
      routedTo,
      type: args.type,
      siteSlug: args.siteSlug,
      name: args.name,
      email: args.email,
      phone: args.phone,
      message: args.message,
    });

    return id;
  },
});

// Admin query
export const list = query({
  args: {
    type: v.optional(
      v.union(
      v.literal("purchase"),
      v.literal("rental"),
      v.literal("general"),
      // Owner-portal comment card; routed to the resort regime managers.
      v.literal("comment_card")
    )
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


const TYPE_LABEL: Record<string, string> = {
  purchase: "Purchase inquiry",
  rental: "Rental inquiry",
  general: "Contact form",
  comment_card: "Owner comment card",
};

/**
 * Email the routing address when an inquiry arrives.
 *
 * Scheduled from `submit` rather than awaited inside it: a Resend outage must
 * not lose the submission or show the visitor an error after the row is saved.
 */
export const notify = internalAction({
  args: {
    inquiryId: v.id("inquiries"),
    routedTo: v.string(),
    type: v.string(),
    siteSlug: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = (globalThis as any).process?.env?.RESEND_API_KEY as
      | string
      | undefined;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; inquiry email skipped");
      return;
    }

    const label = TYPE_LABEL[args.type] ?? "Website inquiry";
    const rows = [
      ["Name", args.name],
      ["Email", args.email],
      ["Phone", args.phone],
      ["Site", args.siteSlug],
    ]
      .filter(([, v]) => !!v)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666;">${k}</td><td style="padding:4px 0;"><strong>${v}</strong></td></tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <h2 style="margin:0 0 16px;font-size:18px;">${label}</h2>
  <table style="font-size:14px;border-collapse:collapse;">${rows}</table>
  ${
    args.message
      ? `<p style="margin-top:18px;white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px;">${args.message}</p>`
      : ""
  }
  <hr style="border:none;border-top:1px solid #eee;margin:26px 0;" />
  <p style="font-size:12px;color:#999;">Reply directly to this email to reach ${args.name}.</p>
</body></html>`.trim();

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hilton Head Timeshares <noreply@lead-works.com>",
        to: [args.routedTo],
        reply_to: args.email,
        subject: `${label} from ${args.name}`,
        html,
      }),
    });
    if (!resp.ok) {
      // Throwing makes it visible in the Convex logs and retried by the
      // scheduler rather than failing silently.
      throw new Error(`Resend error: ${await resp.text()}`);
    }
  },
});
