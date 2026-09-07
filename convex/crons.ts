import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync Airbnb calendars every 2 hours
crons.interval(
  "sync-airbnb-calendars",
  { hours: 2 },
  internal.calendar.syncAllWeeks
);

export default crons;
