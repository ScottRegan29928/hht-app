import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

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

// Age out owner marketplace listings once a day. The WordPress portals
// expired listings after one year; reads already hide stale rows, so this
// only keeps the stored status honest for the admin view.
crons.interval(
  "expire-marketplace-listings",
  { hours: 24 },
  internal.marketplace.expireStaleListings,
  {}
);

// Refresh rental photo URLs from HostAway daily. HostAway rotates its S3
// objects, so stored URLs quietly start returning 403 and the site shows broken
// images (118 dead URLs across 30 rentals, found 2026-09-12).
crons.interval("sync-hostaway-photos", { hours: 24 }, internal.hostawayApi.syncPhotos, {});

// Publish scheduled blog posts (WP "future" posts carried over to the dev
// sites) once their scheduledAt passes [scott, 2026-10-08].
crons.interval("publish-scheduled-posts", { minutes: 15 }, internal.content.publishDuePosts, {});

// Guest reviews are read-only from Hostaway; management replies live here.
crons.interval("sync-guest-reviews", { hours: 24 }, internal.guestReviews.sync, {});

export default crons;
