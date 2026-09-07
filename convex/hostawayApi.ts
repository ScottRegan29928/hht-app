import { v } from "convex/values";
import {
  internalAction,
  internalQuery,
  internalMutation,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * HostAway calendar sync, running inside Convex so a cron can drive it.
 *
 * ⚠ PULL-ONLY. Per Scott (2026-09-07): "We will not write to HostAway until
 * we are ready to go live." Every request in this file is a GET. Do not add a
 * POST/PUT/DELETE to HostAway here without an explicit go-live decision.
 *
 * The previous sync lived in scripts/hostaway_sync.py and only ran when
 * someone executed it by hand, which is not a real production sync.
 */

const HOSTAWAY_API = "https://api.hostaway.com/v1";

const TOKEN_KEY = "hostaway:accessToken";

export const readState = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { key }): Promise<any> =>
    await ctx.db
      .query("syncState")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique(),
});

export const writeState = internalMutation({
  args: { key: v.string(), value: v.string(), expiresAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { key, value, expiresAt }): Promise<null> => {
    const existing = await ctx.db
      .query("syncState")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const doc = { key, value, expiresAt, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("syncState", doc);
    return null;
  },
});



/**
 * Return a HostAway access token, reusing the cached one when possible.
 *
 * ⚠ HostAway throttles token creation and starts returning 403 on
 * /accessTokens if you mint them repeatedly. Tokens are valid for ~24 months,
 * so the cron MUST reuse a stored token. Do not "simplify" this back to
 * fetching a fresh token per run — that is what broke the sync on 2026-09-07.
 */
async function getToken(ctx: ActionCtx): Promise<string> {
  const cached = await ctx.runQuery(internal.hostawayApi.readState, {
    key: TOKEN_KEY,
  });
  // Refresh a week before expiry so a long-lived token never expires mid-run.
  if (cached?.value && (cached.expiresAt ?? 0) > Date.now() + 7 * 86400000) {
    return cached.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env ?? {};
  const clientId = env.HOSTAWAY_CLIENT_ID as string | undefined;
  const clientSecret = env.HOSTAWAY_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) {
    throw new Error(
      "HOSTAWAY_CLIENT_ID / HOSTAWAY_CLIENT_SECRET not set on this deployment"
    );
  }

  const res = await fetch(`${HOSTAWAY_API}/accessTokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "general",
    }).toString(),
  });

  if (!res.ok) {
    // If we still hold a token, prefer it over failing the whole sync — a
    // throttled token endpoint should not take availability offline.
    if (cached?.value) return cached.value;
    throw new Error(`HostAway auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("HostAway auth returned no token");

  await ctx.runMutation(internal.hostawayApi.writeState, {
    key: TOKEN_KEY,
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 63072000) * 1000,
  });
  return data.access_token as string;
}



export const recordSyncResult = internalMutation({
  args: {
    propertyId: v.id("properties"),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { propertyId, ok, error }): Promise<null> => {
    await ctx.db.patch(propertyId, {
      hostawayLastSyncAt: ok ? Date.now() : undefined,
      hostawayLastSyncError: ok ? undefined : error,
    });
    return null;
  },
});

/** Sleep helper for pacing requests. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET with retry. HostAway is rate-sensitive: hitting it with 8 concurrent
 * calendar requests returns sporadic HTTP 500s that succeed on retry, so
 * transient 429/5xx are retried with exponential backoff rather than being
 * reported as sync failures.
 */
async function getWithRetry(
  url: string,
  token: string,
  attempts = 4
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Permanent outcomes: return immediately.
    if (res.ok || res.status === 403 || res.status === 404) return res;
    last = res;
    if (res.status === 429 || res.status >= 500) {
      await sleep(500 * Math.pow(2, i) + Math.random() * 250);
      continue;
    }
    return res;
  }
  return last!;
}

/** Collapse a day-by-day availability list into contiguous blocked ranges. */
function toBlockedRanges(
  days: Array<{ date: string; isAvailable?: number | boolean }>,
  endDate: string
) {
  const ranges: Array<{
    startDate: string;
    endDate: string;
    source: "airbnb" | "hostaway" | "hht" | "manual";
    summary: string;
  }> = [];
  let start: string | null = null;

  for (const day of days) {
    if (!day.isAvailable) {
      if (start === null) start = day.date;
    } else if (start !== null) {
      ranges.push({
        startDate: start,
        endDate: day.date,
        source: "hostaway",
        summary: "Blocked (Hostaway)",
      });
      start = null;
    }
  }
  if (start !== null) {
    ranges.push({
      startDate: start,
      endDate,
      source: "hostaway",
      summary: "Blocked (Hostaway)",
    });
  }
  return ranges;
}

/**
 * Sync availability for every property that has a hostawayId.
 *
 * Properties are processed in small concurrent batches: 83 sequential fetches
 * is slow enough to risk the action time limit, while firing all 83 at once
 * invites rate limiting. One property failing must not abort the run, so
 * failures are collected and reported rather than thrown.
 */
export const syncCalendar = internalAction({
  args: {
    daysAhead: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { daysAhead = 180, batchSize = 3, limit = 40 }
  ): Promise<any> => {
    const token = await getToken(ctx);

    const properties = await ctx.runQuery(
      internal.hostawaySync.getAllProperties,
      {}
    );
    // HostAway throttles Convex's egress, so a single run cannot reliably
    // cover all 83 properties. Work on the stalest first and cap the run;
    // successive runs converge on full freshness instead of hammering the
    // same list and failing the same way each time.
    const targets = properties
      .filter((p: any) => p.hostawayId)
      .sort(
        (a: any, b: any) =>
          (a.hostawayLastSyncAt ?? 0) - (b.hostawayLastSyncAt ?? 0)
      )
      .slice(0, limit);

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + daysAhead * 86400000)
      .toISOString()
      .slice(0, 10);

    let synced = 0;
    let blockedRanges = 0;
    const errors: string[] = [];
    const missing: string[] = [];

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (prop: any) => {
          try {
            const url =
              `${HOSTAWAY_API}/listings/${prop.hostawayId}/calendar` +
              `?startDate=${startDate}&endDate=${endDate}`;
            const res = await getWithRetry(url, token);

            // 403/404 means the listing is not in HostAway at all (deleted, or
            // an ID we hold that HostAway never had). That is a permanent data
            // mismatch, not an outage — keep it separate so a genuine HostAway
            // failure is still visible in the error count.
            if (res.status === 403 || res.status === 404) {
              missing.push(`${prop.address ?? prop._id} (id ${prop.hostawayId})`);
              await ctx.runMutation(internal.hostawayApi.recordSyncResult, {
                propertyId: prop._id,
                ok: false,
                error: `Not in HostAway (HTTP ${res.status})`,
              });
              return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const days = (await res.json()).result ?? [];
            const bookings = toBlockedRanges(days, endDate);

            await ctx.runMutation(
              internal.hostawaySync.upsertCalendarBookings,
              { propertyId: prop._id, bookings }
            );

            await ctx.runMutation(internal.hostawayApi.recordSyncResult, {
              propertyId: prop._id,
              ok: true,
            });
            synced += 1;
            blockedRanges += bookings.length;
          } catch (err: any) {
            errors.push(`${prop.address ?? prop._id}: ${err.message}`);
            await ctx.runMutation(internal.hostawayApi.recordSyncResult, {
              propertyId: prop._id,
              ok: false,
              error: err.message,
            });
          }
        })
      );
      // Pace batches so a full 83-property run stays under HostAway's limits.
      if (i + batchSize < targets.length) await sleep(300);
    }

    const summary = {
      considered: targets.length,
      synced,
      blockedRanges,
      errors: errors.length,
      errorDetail: errors.slice(0, 10),
      missingInHostaway: missing.length,
      missingDetail: missing,
      ranAt: new Date().toISOString(),
    };
    console.log("HostAway calendar sync", JSON.stringify(summary));
    return summary;
  },
});
