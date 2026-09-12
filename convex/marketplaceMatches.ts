import {
  query,
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { expandWeeks } from "./marketplace";

/**
 * Match alerts for the owner marketplace [scott, 2026-09-12]:
 *
 *   "If someone posts a wants-to-buy listing with a specific week or a trade
 *    listing with a specific week, and an owner has those weeks, it should
 *    1) show up as a notification in their portal, and 2) send an alert email."
 *
 * Design notes worth keeping:
 *
 *  - Matching is on the *week the poster wants*, not the week they hold. For a
 *    want_to_buy that is the listing's own week; for a trade it is the desired
 *    week. Getting this backwards would alert the wrong half of the pool.
 *  - Multi-week labels are expanded ("31 & 32" -> 31, 32), so an owner of week
 *    32 hears about a listing whose weekNumber field says 31.
 *  - A match row is created first and the email is scheduled from it, so a
 *    Resend outage costs the email, never the in-portal notification.
 *  - Owners are never alerted about their own listing.
 *  - One row per (owner, listing): editing a listing re-runs matching and adds
 *    only genuinely new weeks, so nobody is emailed twice for the same post.
 */

const MATCHABLE = new Set(["want_to_buy", "trade"]);

async function requireOwnerProfile(ctx: any): Promise<Doc<"userProfiles">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (!profile || profile.role !== "owner") {
    const authUser = await ctx.db.get(userId);
    if (authUser?.email) {
      const byEmail = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
        .first();
      if (byEmail && byEmail.role === "owner") profile = byEmail;
    }
  }
  if (!profile || profile.role !== "owner")
    throw new Error("Owner access required");
  return profile as Doc<"userProfiles">;
}

/**
 * The weeks a listing is *looking for*.
 *
 * want_to_buy: the week the poster wants to buy — the listing's own week.
 * trade:       the week they want in exchange — the desired week. A trade with
 *              no stated desired week ("Flexible") matches nobody, which is
 *              correct; alerting every owner in the pool would be spam.
 */
export function wantedWeeks(listing: {
  kind: string;
  weekNumbers?: number[];
  weekLabel?: string;
  desiredWeekNumbers?: number[];
  desiredWeekLabel?: string;
}): number[] {
  if (listing.kind === "want_to_buy") {
    return listing.weekNumbers?.length
      ? listing.weekNumbers
      : expandWeeks(listing.weekLabel);
  }
  if (listing.kind === "trade") {
    return listing.desiredWeekNumbers?.length
      ? listing.desiredWeekNumbers
      : expandWeeks(listing.desiredWeekLabel);
  }
  return [];
}

/**
 * Find every owner holding a week this listing wants and record a match.
 * Called after a listing is created or updated. Returns how many were new.
 */
export const runForListing = internalMutation({
  args: { listingId: v.id("marketplaceListings") },
  returns: v.object({ created: v.number(), weeks: v.array(v.number()) }),
  handler: async (ctx, { listingId }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing || listing.status !== "active" || !MATCHABLE.has(listing.kind))
      return { created: 0, weeks: [] };

    const weeks = wantedWeeks(listing);
    if (weeks.length === 0) return { created: 0, weeks: [] };

    // Communities the listing is relevant to. A listing scoped to a community
    // only matches weeks in that community; an unscoped one matches the pool.
    const scoped = listing.communitySlug;

    const owned = await ctx.db.query("weeks").collect();
    const communities = await ctx.db.query("communities").collect();
    const communityById = new Map(communities.map((c) => [c._id, c]));

    let created = 0;
    const seen = new Set<string>();

    for (const week of owned) {
      if (!week.ownerId) continue; // company-held stock, not an owner
      if (!weeks.includes(week.weekNumber)) continue;
      if (week.ownerId === listing.ownerProfileId) continue; // never self-alert

      const property: any = await ctx.db.get(week.propertyId);
      const community = property?.communityId
        ? communityById.get(property.communityId)
        : undefined;
      if (scoped && community?.slug && community.slug !== scoped) continue;

      // One alert per owner per listing, even across several matching weeks.
      const key = `${week.ownerId}`;
      if (seen.has(key)) continue;
      const already = await ctx.db
        .query("marketplaceMatches")
        .withIndex("by_owner_listing", (q) =>
          q.eq("ownerProfileId", week.ownerId!).eq("listingId", listingId)
        )
        .first();
      if (already) {
        seen.add(key);
        continue;
      }

      const matchId = await ctx.db.insert("marketplaceMatches", {
        ownerProfileId: week.ownerId,
        listingId,
        kind: listing.kind as "want_to_buy" | "trade",
        weekNumber: week.weekNumber,
        year: week.year,
        unitNumber: property?.address ?? undefined,
        communitySlug: community?.slug,
        createdAt: Date.now(),
      });
      seen.add(key);
      created++;

      // Email is scheduled, not awaited: the notification must survive a
      // Resend failure.
      await ctx.scheduler.runAfter(0, internal.marketplaceMatches.sendEmail, {
        matchId,
      });
    }

    return { created, weeks };
  },
});

/** The signed-in owner's alerts, newest first, with the listing attached. */
export const myMatches = query({
  args: { includeDismissed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const rows = await ctx.db
      .query("marketplaceMatches")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();

    const visible = args.includeDismissed
      ? rows
      : rows.filter((r) => !r.dismissedAt);

    const out = [];
    for (const r of visible.sort((a, b) => b.createdAt - a.createdAt)) {
      const listing = await ctx.db.get(r.listingId);
      // A withdrawn listing's alert is dropped rather than shown as a dead end.
      if (!listing || listing.status !== "active") continue;
      out.push({
        _id: r._id,
        kind: r.kind,
        weekNumber: r.weekNumber,
        year: r.year,
        unitNumber: r.unitNumber,
        readAt: r.readAt,
        createdAt: r.createdAt,
        listing: {
          _id: listing._id,
          kind: listing.kind,
          communitySlug: listing.communitySlug,
          unitNumber: listing.unitNumber,
          weekLabel: listing.weekLabel,
          desiredWeekLabel: listing.desiredWeekLabel,
          notes: listing.notes,
          contactName: listing.contactName,
          contactEmail: listing.contactEmail,
          contactPhone: listing.contactPhone,
          postedAt: listing.postedAt,
        },
      });
    }
    return out;
  },
});

/** Unread count for the nav bell. */
export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const profile = await requireOwnerProfile(ctx);
    const rows = await ctx.db
      .query("marketplaceMatches")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();
    let n = 0;
    for (const r of rows) {
      if (r.readAt || r.dismissedAt) continue;
      const listing = await ctx.db.get(r.listingId);
      if (listing && listing.status === "active") n++;
    }
    return n;
  },
});

export const markRead = mutation({
  args: { matchIds: v.optional(v.array(v.id("marketplaceMatches"))) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnerProfile(ctx);
    const now = Date.now();
    const rows = args.matchIds
      ? await Promise.all(args.matchIds.map((id) => ctx.db.get(id)))
      : await ctx.db
          .query("marketplaceMatches")
          .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
          .collect();
    for (const r of rows) {
      if (!r) continue;
      // Never let one owner mark another's alerts read.
      if (r.ownerProfileId !== profile._id) continue;
      if (!r.readAt) await ctx.db.patch(r._id, { readAt: now });
    }
    return null;
  },
});

export const dismiss = mutation({
  args: { matchId: v.id("marketplaceMatches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const profile = await requireOwnerProfile(ctx);
    const row = await ctx.db.get(matchId);
    if (!row || row.ownerProfileId !== profile._id)
      throw new Error("Not your notification");
    await ctx.db.patch(matchId, { dismissedAt: Date.now() });
    return null;
  },
});

/** Internal: mark the email outcome on a match row. */
export const recordEmail = internalMutation({
  args: {
    matchId: v.id("marketplaceMatches"),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { matchId, error }) => {
    await ctx.db.patch(matchId, {
      emailedAt: error ? undefined : Date.now(),
      emailError: error,
    });
    return null;
  },
});

/** Internal: everything the email needs, resolved in one read. */
export const emailPayload = internalMutation({
  args: { matchId: v.id("marketplaceMatches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return null;
    const owner = await ctx.db.get(match.ownerProfileId);
    const listing = await ctx.db.get(match.listingId);
    if (!owner?.email || !listing) return null;

    // Which portal to link to: the owner's own community, falling back to the
    // listing's. Never built from sites.domain — that is still WordPress until
    // cutover. See ownerInvites.resolveHost for the same rule.
    const siteSlug =
      match.communitySlug === "spicebush"
        ? "spicebush"
        : match.communitySlug === "swallowtail-at-sea-pines"
          ? "swallowtail"
          : listing.originSiteSlug;
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
      .first();

    return {
      to: owner.email,
      firstName: owner.firstName ?? owner.displayName ?? "there",
      kind: match.kind,
      weekNumber: match.weekNumber,
      year: match.year,
      unitNumber: match.unitNumber,
      siteName: site?.name ?? "Owner Portal",
      domain: site?.domain ?? "hht.lead-works.com",
      altDomains: site?.altDomains ?? [],
      listing: {
        weekLabel: listing.weekLabel,
        desiredWeekLabel: listing.desiredWeekLabel,
        unitNumber: listing.unitNumber,
        notes: listing.notes,
        contactName: listing.contactName,
        contactEmail: listing.contactEmail,
        contactPhone: listing.contactPhone,
      },
    };
  },
});

async function resolveHost(site: {
  domain: string;
  altDomains: string[];
}): Promise<string> {
  for (const host of [site.domain, ...site.altDomains]) {
    try {
      const resp = await fetch(`https://${host}/robots.txt`);
      if (resp.ok && (await resp.text()).includes("Disallow: /owner"))
        return host;
    } catch {
      /* try the next candidate */
    }
  }
  return site.altDomains.find((h) => h.endsWith("lead-works.com")) ?? site.domain;
}

const esc = (s?: string | null) =>
  (s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );

export const sendEmail = internalAction({
  args: { matchId: v.id("marketplaceMatches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const apiKey = (globalThis as any).process?.env?.RESEND_API_KEY as
      | string
      | undefined;
    const data: any = await ctx.runMutation(
      internal.marketplaceMatches.emailPayload,
      { matchId }
    );
    if (!data) return null;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; match alert email skipped");
      await ctx.runMutation(internal.marketplaceMatches.recordEmail, {
        matchId,
        error: "RESEND_API_KEY not configured",
      });
      return null;
    }

    const host = await resolveHost(data);
    const link = `https://${host}/owner/marketplace`;
    const weekText = `week ${data.weekNumber}${data.year ? ` (${data.year})` : ""}`;
    const action =
      data.kind === "want_to_buy"
        ? `is looking to <strong>buy</strong> ${esc(weekText)}`
        : `is looking to <strong>trade for</strong> ${esc(weekText)}`;
    const l = data.listing;
    const contactBits = [
      l.contactName && esc(l.contactName),
      l.contactPhone && esc(l.contactPhone),
      l.contactEmail &&
        `<a href="mailto:${esc(l.contactEmail)}" style="color:#0e5c6b;">${esc(l.contactEmail)}</a>`,
    ].filter(Boolean);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#24313d;">
  <h2 style="margin:0 0 4px;font-size:19px;color:#0e5c6b;">Someone wants a week you own</h2>
  <p style="margin:0 0 18px;font-size:14px;color:#6b7a87;">${esc(data.siteName)} owner marketplace</p>
  <p style="font-size:15px;line-height:1.55;margin:0 0 16px;">
    Hi ${esc(data.firstName)}, another owner ${action}${
      data.unitNumber ? ` — the week you hold at ${esc(data.unitNumber)}` : ""
    }.
  </p>
  <div style="border:1px solid #dfe5ea;border-radius:10px;padding:16px;margin:0 0 20px;background:#f8fafb;">
    <table style="font-size:14px;border-collapse:collapse;">
      ${[
        ["Looking for", data.kind === "want_to_buy" ? l.weekLabel : l.desiredWeekLabel],
        ["Their unit", l.unitNumber],
        ["They own", data.kind === "trade" ? l.weekLabel : null],
        ["Note", l.notes],
      ]
        .filter(([, val]) => !!val)
        .map(
          ([k, val]) =>
            `<tr><td style="padding:3px 14px 3px 0;color:#6b7a87;vertical-align:top;">${k}</td><td style="padding:3px 0;"><strong>${esc(String(val))}</strong></td></tr>`
        )
        .join("")}
    </table>
    ${
      contactBits.length
        ? `<p style="margin:12px 0 0;font-size:14px;color:#24313d;">Contact: ${contactBits.join(" &middot; ")}</p>`
        : ""
    }
  </div>
  <p style="margin:0 0 24px;">
    <a href="${link}" style="display:inline-block;background:#0e5c6b;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;">View it in your portal</a>
  </p>
  <p style="font-size:12px;color:#8b97a2;line-height:1.5;margin:0;">
    You are receiving this because you own ${esc(weekText)}. Listings and trades
    between owners are arranged directly; the association is not a party to them.
  </p>
</body></html>`;

    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${data.siteName} <noreply@lead-works.com>`,
          to: [data.to],
          subject:
            data.kind === "want_to_buy"
              ? `Someone wants to buy ${weekText}`
              : `Someone wants to trade for ${weekText}`,
          html,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        await ctx.runMutation(internal.marketplaceMatches.recordEmail, {
          matchId,
          error: `Resend ${resp.status}: ${body.slice(0, 200)}`,
        });
        return null;
      }
      await ctx.runMutation(internal.marketplaceMatches.recordEmail, {
        matchId,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.marketplaceMatches.recordEmail, {
        matchId,
        error: String(err).slice(0, 200),
      });
    }
    return null;
  },
});

/**
 * Backfill: run matching over every existing active listing. Used once after
 * the feature shipped so the alerts reflect listings already in the pool, and
 * safe to re-run because runForListing skips owners already notified.
 */
export const backfillAll = internalMutation({
  args: {},
  returns: v.object({ listings: v.number(), created: v.number() }),
  handler: async (ctx): Promise<{ listings: number; created: number }> => {
    const all = await ctx.db.query("marketplaceListings").collect();
    const candidates = all.filter(
      (l) => l.status === "active" && MATCHABLE.has(l.kind)
    );
    let created = 0;
    for (const l of candidates) {
      const r: { created: number } = await ctx.runMutation(
        internal.marketplaceMatches.runForListing,
        { listingId: l._id }
      );
      created += r.created;
    }
    return { listings: candidates.length, created };
  },
});

/**
 * Maintenance: drop alerts whose owner profile or listing no longer exists.
 *
 * Deleting an owner leaves their match rows behind — they are keyed by profile
 * id, and nothing else cascades. Harmless (every read resolves the listing and
 * the owner) but it accumulates, so this is the broom.
 */
export const pruneOrphans = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), deleted: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("marketplaceMatches").collect();
    let deleted = 0;
    for (const r of rows) {
      const owner = await ctx.db.get(r.ownerProfileId);
      const listing = await ctx.db.get(r.listingId);
      if (!owner || !listing) {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    return { scanned: rows.length, deleted };
  },
});
