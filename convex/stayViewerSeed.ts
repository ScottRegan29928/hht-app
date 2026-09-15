import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Turns the four "Arriving and staying" documents into real screens.
 *
 * Scott, 2026-09-15: "It would be nice if we made this section more 2026
 * rather than 1980." Each of the four now opens something you can read and
 * act on, with the PDF demoted to a takeaway (or dropped, for late arrival).
 *
 * The body text is transcribed from the resorts' own PDFs — this is the
 * client's wording, not rewritten copy. Two deliberate normalizations, both
 * flagged to Scott:
 *
 *  1. Swallowtail's "Directions for Checking In" PDF extracts out of document
 *     order (the gate-pass paragraph prints first, and the toll sentence is
 *     truncated mid-clause). Since both resorts describe the identical drive
 *     to the identical gate, Swallowtail's body is the Spicebush text with the
 *     villa name changed, rather than a faithful copy of a corrupt file.
 *  2. Activity phone numbers are printed as 7 digits in the PDF. Scott
 *     [2026-09-15] asked for the 843 area code shown in full and every number
 *     live, so they are stored as 843-NNN-NNNN. The toll is $10 without a
 *     pass [scott, 2026-09-15]; the PDFs still say $1.25.
 *
 * Re-runnable: skips a document that already carries a viewer unless `force`,
 * so an admin edit in the portal is never clobbered by a redeploy.
 */

const DIRECTIONS = (villa: string) => `I-95 to SC Exit 8 (Highway 278), travel east, following the signs to Hilton Head. Travel approximately 30 miles. Cross 2 bridges onto Hilton Head Island. Get in the left lane to exit onto the Cross Island Expressway. Travel through the toll ($10 without a pass), and cross the bridge. This road becomes Palmetto Bay Road. Stay in the right lane as you approach the traffic circle, bearing right onto Greenwood Drive.

Gate passes are required for entrance into Sea Pines and are picked up at The Sea Pines Welcome Center, located on the right just before the Sea Pines Main Gate. The gate pass pick-up window is at the rear of the Welcome Center. Drive up to the pass window and give the attendant your name — your vehicle pass will be waiting.

All owners then proceed to your owned villa in ${villa}. Email confirmations and door codes are sent out 3 days prior to arrival. Codes will not activate prior to 4:00 p.m. If you don't have an email address, please proceed to the Harbour Town Yacht Club to pick up your welcome packet, located at 149 Lighthouse Road in Harbour Town.`;

const LATE_ARRIVAL = `If you are checking in after our 9:00 p.m. office hour, follow the late-arrival procedure below.

If you are an owner and have received your door code, proceed directly to your villa.

All others go to the Harbour Town Yacht Club, where you will find a locked box outside the front door. The combination for the box is 245. Remove only the envelope with your last name and address on it — your door code and directions to your villa are inside.

If you need additional help, use the telephone located inside the breezeway. Call 843-671-1400 and it will be placed automatically to our answering service.

Our office reopens at 7:00 a.m. for any additional questions you may have.`;

const OUTDOOR = `Alligator Adventure — 843-842-1979
Come aboard our safe and stable safari boat for a chance to see the American alligator in its natural habitat.

Charter Fishing — 843-671-4534
Sportfishing with Hilton Head's best: redfish, tarpon, cobia, king mackerel, barracuda, Spanish mackerel, sharks, bluefish and amberjack. 4-8 hour charters.

Environmental Tours — 843-671-4386
Explore, discover and learn. Join us for a dolphin, nature, sunset or beachcombing tour. Customized trips are also available.

Horseback Riding — 843-671-2586
Explore the Sea Pines Forest Preserve on horseback and enjoy the natural beauty of Sea Pines. Pony rides are also available at Lawton Stables for children 8 and under; please call for more information.

Kayak Expeditions — 843-842-1979
Calm water paddling, guided tours and rentals are available, in singles and doubles.

Parasailing — 843-671-4386
Get an eagle's eye view of Hilton Head and the surrounding area with H2O Sports. See up to 20 miles in every direction. Fun for all ages and the whole family.

Sailboats — 843-671-4386
Sail away on a Stiletto catamaran cruise, or rent a sailboat for yourself. Powerboats are also available for rent.

Water Ski — 843-671-4386
Experience the calm waters of Bull Creek skiing, knee boarding and wakeboarding. No experience needed.

Wave Runners — 843-671-4386
Take off on an all-new Yamaha wave runner and experience the vast waters for yourself. Enjoy our large riding area.

Some activities may vary depending on the season.`;

const CALENDAR_INTRO = `Weeks run Friday to Friday, so the calendar dates for your week shift slightly each year. Pick a year below to see the exact dates, or look up which week a particular date falls in.`;

type Plan = {
  match: RegExp;
  viewer: "content" | "calendar" | "directions";
  body: (site: string) => string;
  hideDownload?: boolean;
};

const PLANS: Plan[] = [
  {
    match: /resort calendar/i,
    viewer: "calendar",
    body: () => CALENDAR_INTRO,
  },
  {
    match: /directions for checking in/i,
    viewer: "directions",
    body: (site) =>
      DIRECTIONS(site === "swallowtail" ? "Swallowtail" : "Spicebush"),
  },
  {
    match: /late.?arrival/i,
    viewer: "content",
    body: () => LATE_ARRIVAL,
    // No download [scott, 2026-09-15].
    hideDownload: true,
  },
  {
    match: /outdoor activities/i,
    viewer: "content",
    body: () => OUTDOOR,
  },
];

export const seedStayViewers = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const docs = await ctx.db.query("ownerDocuments").collect();
    const report: string[] = [];
    for (const doc of docs.filter((d) => d.category === "stay")) {
      const plan = PLANS.find((p) => p.match.test(doc.title));
      if (!plan) {
        report.push(`skip (no plan): ${doc.siteSlug} / ${doc.title}`);
        continue;
      }
      if (doc.viewer && !force) {
        report.push(`skip (already set): ${doc.siteSlug} / ${doc.title}`);
        continue;
      }
      await ctx.db.patch(doc._id, {
        viewer: plan.viewer,
        body: plan.body(doc.siteSlug),
        hideDownload: plan.hideDownload ?? false,
        updatedAt: Date.now(),
      });
      report.push(`set ${plan.viewer}: ${doc.siteSlug} / ${doc.title}`);
    }
    return report;
  },
});
