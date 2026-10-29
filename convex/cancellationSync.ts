import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getToken, getWithRetry } from "./hostawayApi";
import { cancellationMatches } from "./bookingReconciliation";

export const candidates = internalQuery({
  args: { sessionId: v.optional(v.id("checkoutSessions")) },
  returns: v.any(),
  handler: async (ctx, { sessionId }): Promise<any> => {
    const rows = sessionId ? [await ctx.db.get(sessionId)] : await ctx.db.query("checkoutSessions")
      .withIndex("by_status", q => q.eq("status", "confirmed")).collect();
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter(s => s && s.status === "confirmed" && s.hostawayReservationId &&
      s.calendarBookingId && (sessionId || s.checkOut >= today))
      .sort((a, b) => (a!.cancellationCheckedAt ?? 0) - (b!.cancellationCheckedAt ?? 0))
      .slice(0, 10).map(s => ({ sessionId: s!._id, reservationId: s!.hostawayReservationId }));
  },
});

export const apply = internalMutation({
  args: { sessionId: v.id("checkoutSessions"), reservation: v.optional(v.any()),
    error: v.optional(v.string()), dryRun: v.boolean() },
  returns: v.any(),
  handler: async (ctx, { sessionId, reservation, error, dryRun }): Promise<any> => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.status !== "confirmed") return { released: false, reason: "not_confirmed" };
    const canceled = ["canceled", "cancelled"].includes(String(reservation?.status).toLowerCase());
    let reason = error;
    if (canceled) {
      const property = await ctx.db.get(s.propertyId);
      const hold = s.calendarBookingId ? await ctx.db.get(s.calendarBookingId) : null;
      const booking = s.bookingId ? await ctx.db.get(s.bookingId) : null;
      if (cancellationMatches(s, property, reservation, hold, booking)) {
        if (!dryRun) {
          await ctx.db.delete(s.calendarBookingId!);
          await ctx.db.patch(s.bookingId!, { status: "cancelled" });
          await ctx.db.patch(sessionId, {
            status: "canceled", calendarBookingId: undefined, canceledAt: Date.now(),
            cancellationCheckedAt: Date.now(), cancellationSyncError: undefined,
            error: "Canceled in Hostaway. Availability released; refunds are handled separately.",
            updatedAt: Date.now(),
          });
        }
        return { released: !dryRun, wouldRelease: true, reservationId: s.hostawayReservationId };
      }
      reason = "Canceled reservation does not match the linked property, dates, booking and website hold. Manual review required.";
    }
    if (!dryRun) await ctx.db.patch(sessionId, {
      cancellationCheckedAt: Date.now(), cancellationSyncError: reason,
    });
    return { released: false, reason: reason ?? "reservation_active" };
  },
});

/** Read-only in Hostaway. Never cancels a reservation or changes any payment. */
export const reconcile = internalAction({
  args: { sessionId: v.optional(v.id("checkoutSessions")), dryRun: v.optional(v.boolean()) },
  returns: v.any(),
  handler: async (ctx, { sessionId, dryRun = false }): Promise<any> => {
    const targets: any[] = await ctx.runQuery(internal.cancellationSync.candidates, { sessionId });
    if (!targets.length) return { checked: 0, released: 0, results: [] };
    const token = await getToken(ctx);
    const results: any[] = [];
    for (const target of targets) {
      try {
        const res = await getWithRetry(`https://api.hostaway.com/v1/reservations/${target.reservationId}`, token);
        if (!res.ok) throw new Error(`Hostaway HTTP ${res.status}; hold retained`);
        const payload = await res.json();
        if (payload.status !== "success" || !payload.result?.id) throw new Error("Invalid reservation response; hold retained");
        results.push(await ctx.runMutation(internal.cancellationSync.apply, {
          sessionId: target.sessionId, reservation: payload.result, dryRun,
        }));
      } catch (e) {
        results.push(await ctx.runMutation(internal.cancellationSync.apply, {
          sessionId: target.sessionId, error: String(e), dryRun,
        }));
      }
    }
    const summary = { checked: targets.length, released: results.filter(r => r.released).length, results };
    console.log("Website cancellation reconciliation", JSON.stringify(summary));
    return summary;
  },
});
