import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
export const getWeekSyncStatus = query({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, { weekId }) => {
    const week = await ctx.db.get(weekId);
    if (!week) return null;
    return {
      airbnbCalendarUrl: week.airbnbCalendarUrl,
      lastSyncAt: week.lastSyncAt,
      lastSyncError: week.lastSyncError,
    };
  },
});

// ── iCal generation: build .ics content for a week ──
export const generateIcal = query({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, { weekId }) => {
    const week = await ctx.db.get(weekId);
    if (!week) return null;

    const property = await ctx.db.get(week.propertyId);
    if (!property) return null;

    const community = await ctx.db.get(property.communityId);

    // Get all bookings for this week
    const bookings = await ctx.db
      .query("calendarBookings")
      .withIndex("by_week", (q) => q.eq("weekId", weekId))
      .collect();

    const now = new Date();
    const stamp = formatIcalDate(now);
    const calName = `${property.address} - Week ${week.weekNumber}`;

    let ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//HiltonHeadTimeshares//HHT//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${calName}`,
    ];

    for (const booking of bookings) {
      const uid = booking.uid || `${booking._id}@hht.leadworksstaging.com`;
      ical.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${booking.startDate.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${booking.endDate.replace(/-/g, "")}`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${booking.summary || "Reserved"}`,
        `DESCRIPTION:${property.address}${community ? ` - ${community.name}` : ""}`,
        "TRANSP:OPAQUE",
        "END:VEVENT"
      );
    }

    ical.push("END:VCALENDAR");
    return ical.join("\r\n");
  },
});

function formatIcalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ── Internal: upsert bookings from parsed iCal data ──
export const upsertBookingsFromSync = internalMutation({
  args: {
    weekId: v.id("weeks"),
    propertyId: v.id("properties"),
    bookings: v.array(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
        summary: v.optional(v.string()),
        uid: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { weekId, propertyId, bookings }) => {
    // Get existing airbnb bookings for this week
    const existing = await ctx.db
      .query("calendarBookings")
      .withIndex("by_week", (q) => q.eq("weekId", weekId))
      .collect();

    const airbnbExisting = existing.filter((b) => b.source === "airbnb");
    const incomingUids = new Set(bookings.map((b) => b.uid).filter(Boolean));
    const existingUidMap = new Map(
      airbnbExisting.filter((b) => b.uid).map((b) => [b.uid!, b])
    );

    const now = Date.now();

    // Upsert incoming bookings
    for (const booking of bookings) {
      if (booking.uid && existingUidMap.has(booking.uid)) {
        // Update existing
        const ex = existingUidMap.get(booking.uid)!;
        if (ex.startDate !== booking.startDate || ex.endDate !== booking.endDate || ex.summary !== booking.summary) {
          await ctx.db.patch(ex._id, {
            startDate: booking.startDate,
            endDate: booking.endDate,
            summary: booking.summary,
            updatedAt: now,
          });
        }
      } else {
        // Insert new
        await ctx.db.insert("calendarBookings", {
          weekId,
          propertyId,
          startDate: booking.startDate,
          endDate: booking.endDate,
          source: "airbnb",
          summary: booking.summary,
          uid: booking.uid,
          createdAt: now,
        });
      }
    }

    // Remove airbnb bookings that are no longer in the feed
    for (const ex of airbnbExisting) {
      if (ex.uid && !incomingUids.has(ex.uid)) {
        await ctx.db.delete(ex._id);
      }
    }

    // Update week sync timestamp
    await ctx.db.patch(weekId, {
      lastSyncAt: now,
      lastSyncError: undefined,
    });
  },
});

// ── Internal: mark sync error ──
export const markSyncError = internalMutation({
  args: {
    weekId: v.id("weeks"),
    error: v.string(),
  },
  handler: async (ctx, { weekId, error }) => {
    await ctx.db.patch(weekId, {
      lastSyncAt: Date.now(),
      lastSyncError: error,
    });
  },
});

// ── Internal action: fetch and parse one Airbnb iCal feed ──
export const syncOneWeek = internalAction({
  args: {
    weekId: v.id("weeks"),
    propertyId: v.id("properties"),
    airbnbCalendarUrl: v.string(),
  },
  handler: async (ctx, { weekId, propertyId, airbnbCalendarUrl }) => {
    try {
      const response = await fetch(airbnbCalendarUrl, {
        headers: { "User-Agent": "HHT-Calendar-Sync/1.0" },
      });

      if (!response.ok) {
        await ctx.runMutation(internal.calendar.markSyncError, {
          weekId,
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
        return;
      }

      const icalText = await response.text();
      const bookings = parseIcal(icalText);

      await ctx.runMutation(internal.calendar.upsertBookingsFromSync, {
        weekId,
        propertyId,
        bookings,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.calendar.markSyncError, {
        weekId,
        error: err.message || "Unknown error",
      });
    }
  },
});

// ── Internal action: sync ALL weeks that have Airbnb URLs ──
export const syncAllWeeks = internalAction({
  args: {},
  handler: async (ctx) => {
    // Use a query to find weeks with airbnb URLs
    const weeks: any[] = await ctx.runQuery(internal.calendar.listWeeksWithAirbnb);

    for (const week of weeks) {
      await ctx.runAction(internal.calendar.syncOneWeek, {
        weekId: week._id,
        propertyId: week.propertyId,
        airbnbCalendarUrl: week.airbnbCalendarUrl,
      });
    }
  },
});

// ── Internal query: get weeks with Airbnb calendar URLs ──
export const listWeeksWithAirbnb = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allWeeks = await ctx.db.query("weeks").collect();
    return allWeeks
      .filter((w) => w.airbnbCalendarUrl)
      .map((w) => ({
        _id: w._id,
        propertyId: w.propertyId,
        airbnbCalendarUrl: w.airbnbCalendarUrl!,
      }));
  },
});

// ── Admin action: manual sync trigger ──
export const triggerSync = action({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, { weekId }) => {
    const week: any = await ctx.runQuery(api.calendar.getWeekSyncStatus, { weekId });
    if (!week?.airbnbCalendarUrl) {
      throw new Error("No Airbnb calendar URL configured for this week");
    }

    // Get the week's propertyId
    const weekData: any = await ctx.runQuery(api.calendar.getWeekForSync, { weekId });
    if (!weekData) throw new Error("Week not found");

    await ctx.runAction(internal.calendar.syncOneWeek, {
      weekId,
      propertyId: weekData.propertyId,
      airbnbCalendarUrl: week.airbnbCalendarUrl,
    });
  },
});

// ── Helper query for triggerSync ──
export const getWeekForSync = query({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, { weekId }) => {
    const week = await ctx.db.get(weekId);
    if (!week) return null;
    return { propertyId: week.propertyId, airbnbCalendarUrl: week.airbnbCalendarUrl };
  },
});

// ── iCal parser (minimal, handles Airbnb's format) ──
function parseIcal(text: string): Array<{
  startDate: string;
  endDate: string;
  summary?: string;
  uid?: string;
}> {
  const events: Array<{
    startDate: string;
    endDate: string;
    summary?: string;
    uid?: string;
  }> = [];

  // Split into lines, handle folded lines (lines starting with space/tab are continuations)
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }

  let inEvent = false;
  let current: { startDate?: string; endDate?: string; summary?: string; uid?: string } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (line === "END:VEVENT") {
      inEvent = false;
      if (current.startDate && current.endDate) {
        events.push({
          startDate: current.startDate,
          endDate: current.endDate,
          summary: current.summary,
          uid: current.uid,
        });
      }
    } else if (inEvent) {
      // Parse DTSTART — handle both DATE and DATE-TIME
      if (line.startsWith("DTSTART")) {
        current.startDate = extractDate(line);
      } else if (line.startsWith("DTEND")) {
        current.endDate = extractDate(line);
      } else if (line.startsWith("SUMMARY:")) {
        current.summary = line.slice(8).trim();
      } else if (line.startsWith("UID:")) {
        current.uid = line.slice(4).trim();
      }
    }
  }

  return events;
}

function extractDate(line: string): string {
  // Formats: DTSTART;VALUE=DATE:20260705 or DTSTART:20260705T120000Z
  const parts = line.split(":");
  const value = parts[parts.length - 1].trim();
  // Extract just the date portion (first 8 chars)
  const dateStr = value.replace(/[^0-9]/g, "").slice(0, 8);
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return value;
}
