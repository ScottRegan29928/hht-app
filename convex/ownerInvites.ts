import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Portal invitations — how an owner first gets into the portal.
 *
 * Why this exists: there is deliberately no self-registration [scott,
 * 2026-09-08], and a password reset on an email with no auth account does
 * nothing. So a pre-registered owner previously had no route in at all. The
 * flow is now:
 *
 *   admin creates the owner  ->  sendInvite (emails a one-time link)
 *   owner opens /owner/activate?token=...  ->  sets a password
 *   client signs up with that email  ->  accept() links profile + marks used
 *
 * Token handling: only a SHA-256 hash is stored, so a database read cannot be
 * replayed as a login. The raw token exists solely inside the emailed link.
 */

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];

function randomToken(): string {
  // No `oslo` dependency available in this project; Web Crypto is in both the
  // Convex runtime and the browser.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

// ── Admin: create + send ───────────────────────────────────────────────────

/**
 * Which portal does this owner belong to? Derived from the community of the
 * weeks they hold, so staff do not have to know that unit 2891 is Swallowtail.
 */
async function inferSiteSlug(ctx: any, profileId: any): Promise<string> {
  const weeks = await ctx.db
    .query("weeks")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", profileId))
    .collect();

  const communitySlugs = new Set<string>();
  for (const w of weeks.slice(0, 25)) {
    const property = await ctx.db.get(w.propertyId);
    if (!property?.communityId) continue;
    const community = await ctx.db.get(property.communityId);
    if (community?.slug) communitySlugs.add(community.slug);
  }

  const sites = await ctx.db.query("sites").collect();
  const portals = sites.filter((s: any) => s.ownerPortalEnabled);
  const match = portals.find((s: any) =>
    (s.communitySlugs ?? []).some((c: string) => communitySlugs.has(c))
  );
  if (match) return match.slug;

  throw new Error(
    "Could not tell which portal this owner belongs to — no weeks on file. " +
      "Assign a week first, or choose the portal explicitly."
  );
}

export const prepare = internalMutation({
  args: { profileId: v.id("userProfiles"), siteSlug: v.optional(v.string()) },
  handler: async (ctx, { profileId, siteSlug: requested }) => {
    const siteSlug = requested ?? (await inferSiteSlug(ctx, profileId));
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Owner not found");
    if (profile.role !== "owner") throw new Error("Not an owner profile");
    if (!profile.email) throw new Error("That owner has no email address");
    if (profile.userId) {
      throw new Error(
        "That owner already has a sign-in. Send them a password reset instead."
      );
    }

    const token = randomToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();

    // Re-inviting replaces the previous token rather than stacking links.
    const existing = await ctx.db
      .query("ownerInvites")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .collect();
    const open = existing.find((e) => !e.acceptedAt && !e.revokedAt);

    if (open) {
      await ctx.db.patch(open._id, {
        tokenHash,
        siteSlug,
        expiresAt: now + INVITE_TTL_MS,
        sentAt: now,
        sentCount: open.sentCount + 1,
      });
    } else {
      await ctx.db.insert("ownerInvites", {
        profileId,
        email: profile.email,
        siteSlug,
        tokenHash,
        expiresAt: now + INVITE_TTL_MS,
        sentAt: now,
        sentCount: 1,
        createdAt: now,
      });
    }

    return {
      token,
      email: profile.email,
      siteSlug,
      name: profile.displayName ?? profile.firstName ?? "Owner",
    };
  },
});

export const siteOrigin = internalQuery({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
      .first();
    return {
      name: site?.name ?? "Owner Portal",
      domain: site?.domain ?? "hht.lead-works.com",
    };
  },
});

/** Admin-facing: build a token, then email the link. */
export const sendInvite = action({
  args: { profileId: v.id("userProfiles"), siteSlug: v.optional(v.string()) },
  handler: async (
    ctx,
    { profileId, siteSlug }
  ): Promise<{ email: string; siteSlug: string }> => {
    // The mutation does its own auth via the calling identity.
    await ctx.runQuery(internal.ownerInvites.assertAdmin, {});
    const invite = await ctx.runMutation(internal.ownerInvites.prepare, {
      profileId,
      siteSlug,
    });
    const site = await ctx.runQuery(internal.ownerInvites.siteOrigin, {
      siteSlug: invite.siteSlug,
    });

    const link = `https://${site.domain}/owner/activate?token=${invite.token}`;
    const apiKey = (globalThis as any).process?.env?.RESEND_API_KEY as
      | string
      | undefined;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <p style="font-size:16px;margin-top:0;">Hello ${invite.name},</p>
  <p>Your owner portal account for <strong>${site.name}</strong> is ready. Use the button below to choose a password and sign in.</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="${link}" style="background:#0c4a5e;color:#fff;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:600;">Set up my portal access</a>
  </p>
  <p>In the portal you can view association documents, newsletters and board minutes, list a week for sale or trade, browse other owners' listings, and pay your maintenance fee.</p>
  <p style="font-size:13px;color:#666;">This link is good for 14 days and can be used once. If it expires, ask The Club Group to send another.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0;" />
  <p style="font-size:13px;color:#999;">${site.name} &middot; managed by The Club Group &middot; Hilton Head Island, SC</p>
</body></html>`.trim();

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${site.name} <noreply@lead-works.com>`,
        to: [invite.email],
        subject: `Set up your ${site.name} owner portal access`,
        html,
        text: `Hello ${invite.name},\n\nYour owner portal account for ${site.name} is ready. Open this link to choose a password:\n\n${link}\n\nThe link is good for 14 days and can be used once.`,
      }),
    });
    if (!resp.ok) throw new Error(`Resend error: ${await resp.text()}`);

    return { email: invite.email, siteSlug: invite.siteSlug };
  },
});

export const assertAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return true;
  },
});

export const revokeInvite = mutation({
  args: { id: v.id("ownerInvites") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});

export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("ownerInvites").collect();
    return rows.sort((a, b) => b.sentAt - a.sentAt);
  },
});

/** Per-owner invite state, for the owners list in /management. */
export const inviteStatusByProfile = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("ownerInvites").collect();
    const out: Record<
      string,
      { sentAt: number; acceptedAt?: number; expiresAt: number; sentCount: number }
    > = {};
    for (const r of rows) {
      if (r.revokedAt) continue;
      const prev = out[r.profileId];
      if (!prev || r.sentAt > prev.sentAt) {
        out[r.profileId] = {
          sentAt: r.sentAt,
          acceptedAt: r.acceptedAt,
          expiresAt: r.expiresAt,
          sentCount: r.sentCount,
        };
      }
    }
    return out;
  },
});

// ── Owner: activate ────────────────────────────────────────────────────────

/**
 * Ungated on purpose: the caller has no session yet. It takes a high-entropy
 * token and returns only the email the invite was issued to, so it cannot be
 * used to enumerate owners.
 */
export const lookup = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 32) return { valid: false as const, reason: "invalid" };
    const tokenHash = await hashToken(token);
    const invite = await ctx.db
      .query("ownerInvites")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!invite) return { valid: false as const, reason: "invalid" };
    if (invite.revokedAt) return { valid: false as const, reason: "revoked" };
    if (invite.acceptedAt) return { valid: false as const, reason: "used" };
    if (invite.expiresAt < Date.now())
      return { valid: false as const, reason: "expired" };

    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", invite.siteSlug))
      .first();

    return {
      valid: true as const,
      email: invite.email,
      siteName: site?.name ?? "Owner Portal",
    };
  },
});

/**
 * Called immediately after the client creates the password account. Links the
 * pre-registered owner profile to the new auth user and burns the token.
 *
 * The signed-in email must match the invite, so a stolen token cannot attach a
 * different account to someone else's ownership record.
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tokenHash = await hashToken(token);
    const invite = await ctx.db
      .query("ownerInvites")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!invite) throw new Error("That invitation link is not valid");
    if (invite.revokedAt) throw new Error("That invitation was withdrawn");
    if (invite.acceptedAt) throw new Error("That invitation was already used");
    if (invite.expiresAt < Date.now())
      throw new Error("That invitation has expired");

    const authUser = await ctx.db.get(userId);
    const email = (authUser as any)?.email as string | undefined;
    if (!email || email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("Signed-in email does not match the invitation");
    }

    const profile = await ctx.db.get(invite.profileId);
    if (!profile) throw new Error("Owner record not found");
    if (!(profile as any).userId) {
      await ctx.db.patch(invite.profileId, { userId });
    }
    await ctx.db.patch(invite._id, { acceptedAt: Date.now() });

    return { siteSlug: invite.siteSlug };
  },
});
