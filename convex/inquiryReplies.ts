import { v } from "convex/values";
import {
  query,
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { isEmailHeld, heldEmailNote } from "./goLive";

/**
 * Replying to a buyer inquiry from inside the portal.
 *
 * Before this, an owner could read an inquiry and nothing else: answering
 * meant leaving the portal for their own email client, and nobody could tell
 * afterwards whether the buyer had ever been answered [scott, 2026-09-13].
 *
 * The reply is recorded first and emailed second, so a mail failure costs the
 * email and never the record — and the failure is stored on the row rather
 * than thrown away, so it can be seen and retried.
 */

const FROM_EMAIL = "Sea Pines Owner Portal <noreply@lead-works.com>";

async function requireProfile(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (!profile) {
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
    }
  }
  if (!profile) throw new Error("No profile");
  return profile;
}

/** An owner may only touch inquiries about properties they hold a week in. */
async function assertMayAccess(ctx: any, profile: any, inquiry: any) {
  if (["admin", "admin_user", "admin_sales", "admin_rental"].includes(profile.role))
    return;
  const weeks = await ctx.db
    .query("weeks")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", profile._id))
    .collect();
  const owns = weeks.some(
    (w: any) => String(w.propertyId) === String(inquiry.propertyId)
  );
  if (!owns) throw new Error("This inquiry is not about a property you own");
}

export const listForInquiry = query({
  args: { inquiryId: v.id("inquiries") },
  handler: async (ctx, { inquiryId }) => {
    const profile = await requireProfile(ctx);
    const inquiry = await ctx.db.get(inquiryId);
    if (!inquiry) return [];
    await assertMayAccess(ctx, profile, inquiry);

    return (
      await ctx.db
        .query("inquiryReplies")
        .withIndex("by_inquiry", (q: any) => q.eq("inquiryId", inquiryId))
        .collect()
    ).sort((a: any, b: any) => a.sentAt - b.sentAt);
  },
});

/** Replies for many inquiries at once, so the list can show counts. */
export const countsForMine = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const replies = await ctx.db
      .query("inquiryReplies")
      .withIndex("by_author", (q: any) => q.eq("authorProfileId", profile._id))
      .collect();
    const byInquiry: Record<string, number> = {};
    for (const r of replies) {
      byInquiry[String(r.inquiryId)] = (byInquiry[String(r.inquiryId)] ?? 0) + 1;
    }
    return byInquiry;
  },
});

export const reply = mutation({
  args: { inquiryId: v.id("inquiries"), body: v.string() },
  handler: async (ctx, { inquiryId, body }) => {
    const profile = await requireProfile(ctx);
    const inquiry = await ctx.db.get(inquiryId);
    if (!inquiry) throw new Error("Inquiry not found");
    await assertMayAccess(ctx, profile, inquiry);

    const text = body.trim();
    if (!text) throw new Error("Please write a reply before sending");

    const authorName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.displayName ||
      profile.email ||
      "Owner";

    const replyId = await ctx.db.insert("inquiryReplies", {
      inquiryId,
      authorProfileId: profile._id,
      authorName,
      authorEmail: profile.email,
      body: text,
      sentAt: Date.now(),
    });

    // Answering an inquiry is what "contacted" means; leaving it on "new"
    // after a reply is how inquiries get answered twice.
    if (inquiry.status === "new") {
      await ctx.db.patch(inquiryId, {
        status: "contacted",
        respondedAt: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.inquiryReplies.send, {
      replyId,
      to: inquiry.email,
      toName: inquiry.name,
      authorName,
      authorEmail: profile.email,
      body: text,
      original: inquiry.message,
    });

    return replyId;
  },
});

export const markEmailed = internalMutation({
  args: {
    replyId: v.id("inquiryReplies"),
    emailedAt: v.optional(v.number()),
    emailError: v.optional(v.string()),
  },
  handler: async (ctx, { replyId, emailedAt, emailError }) => {
    await ctx.db.patch(replyId, { emailedAt, emailError });
  },
});

export const send = internalAction({
  args: {
    replyId: v.id("inquiryReplies"),
    to: v.string(),
    toName: v.optional(v.string()),
    authorName: v.string(),
    authorEmail: v.optional(v.string()),
    body: v.string(),
    original: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ⚠ Pre-launch: the reply is saved and shown in the portal thread, but no
    // mail leaves. Recorded as an explicit reason so nobody reads the reply as
    // delivered. One flag in convex/goLive.ts controls this.
    if (isEmailHeld("inquiry_reply")) {
      console.info(heldEmailNote("inquiry_reply", args.to));
      await ctx.runMutation(internal.inquiryReplies.markEmailed, {
        replyId: args.replyId,
        emailError: "held until go-live (not sent)",
      });
      return;
    }

    const apiKey = (globalThis as any).process?.env?.RESEND_API_KEY as
      | string
      | undefined;
    if (!apiKey) {
      await ctx.runMutation(internal.inquiryReplies.markEmailed, {
        replyId: args.replyId,
        emailError: "RESEND_API_KEY not configured",
      });
      return;
    }

    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paragraphs = args.body
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c2b33;max-width:560px;">
        <p style="margin:0 0 14px;">Hello ${esc(args.toName ?? "there")},</p>
        ${paragraphs}
        <p style="margin:0 0 14px;">${esc(args.authorName)}</p>
        ${
          args.original
            ? `<hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0;">
               <p style="color:#64748b;font-size:13px;margin:0 0 6px;">Your original message:</p>
               <blockquote style="color:#64748b;font-size:13px;margin:0;padding-left:12px;border-left:3px solid #e2e8f0;">
                 ${esc(args.original).replace(/\n/g, "<br>")}
               </blockquote>`
            : ""
        }
      </div>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [args.to],
          // The buyer should be able to hit reply and reach the owner, not us.
          reply_to: args.authorEmail ? [args.authorEmail] : undefined,
          subject: `Re: your inquiry at Sea Pines`,
          html,
        }),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200);
        await ctx.runMutation(internal.inquiryReplies.markEmailed, {
          replyId: args.replyId,
          emailError: `HTTP ${res.status}: ${detail}`,
        });
        return;
      }
      await ctx.runMutation(internal.inquiryReplies.markEmailed, {
        replyId: args.replyId,
        emailedAt: Date.now(),
      });
    } catch (err: any) {
      await ctx.runMutation(internal.inquiryReplies.markEmailed, {
        replyId: args.replyId,
        emailError: String(err).slice(0, 200),
      });
    }
  },
});
