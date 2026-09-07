import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync Airbnb calendars every 2 hours
crons.interval(
  "sync-airbnb-calendars",
  { hours: 2 },
  internal.calendar.syncAllWeeks
);

// Pull rental availability from HostAway every 30 minutes.
//
// Each run refreshes the 40 stalest properties rather than all 83: HostAway
// throttles requests from Convex's egress, so a whole-account sweep fails a
// chunk every time. Small, frequent, staleness-ordered runs converge on full
// freshness (~1 hour for the full account) and retry failures automatically.
//
// Pull-only: we do not write to HostAway until go-live (Scott, 2026-09-07).
crons.interval(
  "sync-hostaway-calendar",
  { minutes: 30 },
  internal.hostawayApi.syncCalendar,
  { daysAhead: 180, limit: 40 }
);

export default crons;
