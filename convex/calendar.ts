import { v } from "convex/values";
import { query } from "./_generated/server";

// ── Public query: get bookings for a week ──
export const getBookings = query({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, { weekId }) => {
    return await ctx.db
      .query("calendarBookings")
      .withIndex("by_week", (q) => q.eq("weekId", weekId))
      .collect();
  },
});

// ── Public query: get bookings for a property (all weeks) ──
export const getPropertyBookings = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    return await ctx.db
      .query("calendarBookings")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .collect();
  },
});

// ── Public query: get week with sync info ──

/**
 * The Airbnb iCal integration was removed on 2026-09-16.
 *
 * It predated HostAway. HostAway is now the channel manager and owns the Airbnb
 * connection, so a second direct feed between this portal and Airbnb was a
 * parallel source of truth for the same calendar - the classic setup for double
 * bookings. Zero of 400 weeks had ever been given an iCal URL and every row in
 * calendarBookings has source "hostaway", so nothing was using it.
 *
 * Removed: generateIcal + the public /api/calendar route, syncOneWeek,
 * syncAllWeeks, listWeeksWithAirbnb, triggerSync, markSyncError,
 * getWeekSyncStatus, getWeekForSync, upsertBookingsFromSync, the
 * sync-airbnb-calendars cron, and the weeks columns airbnbCalendarUrl /
 * lastSyncAt / lastSyncError.
 *
 * Kept: getBookings and getPropertyBookings, which read the HostAway-populated
 * calendarBookings table and drive the public availability calendar.
 */
