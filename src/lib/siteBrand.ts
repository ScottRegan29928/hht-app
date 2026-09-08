/**
 * Per-site brand copy for the four sister sites.
 *
 * Design is deliberately IDENTICAL across Swallowtail and Spicebush — Scott:
 * "Swallowtail and Spicebush will have identical designs. The only difference
 * is content on the website." So this file carries names, wordmarks and copy
 * only. Do not add per-site colors here without that instruction changing.
 *
 * Inventory scoping is enforced on the server (see convex/sites.ts); nothing
 * here affects which properties a site can show.
 */

export type SiteBrand = {
  /** Wordmark, split across two lines in the header */
  wordmarkTop: string;
  wordmarkBottom: string;
  /** Small uppercase line above the hero headline */
  eyebrow: string;
  /** Hero headline, split so the second half can take the accent color */
  headlineTop: string;
  headlineAccent: string;
  /** Hero paragraph */
  intro: string;
  /** Footer blurb */
  footerBlurb: string;
  /** Legal name in the footer copyright */
  legalName: string;
  /** Public phone number, shown in the nav. Only sites that have one set it. */
  phoneDisplay?: string;
  phoneHref?: string;
};

const SEA_PINES_EYEBROW = "Sea Pines · Hilton Head Island";

export const SITE_BRAND: Record<string, SiteBrand> = {
  mhht: {
    phoneDisplay: "843.363.5699",
    phoneHref: "tel:8433635699",
    wordmarkTop: "Hilton Head",
    wordmarkBottom: "Timeshares",
    eyebrow: SEA_PINES_EYEBROW,
    headlineTop: "Your Island",
    headlineAccent: "Getaway Awaits",
    intro:
      "Discover luxury timeshare villas in the heart of Sea Pines. Purchase a week or rent the perfect vacation home on Hilton Head Island.",
    footerBlurb:
      "Luxury timeshare rentals and sales at Sea Pines on Hilton Head Island.",
    legalName: "Hilton Head Timeshares",
  },
  heritage: {
    wordmarkTop: "Heritage",
    wordmarkBottom: "Vacations",
    eyebrow: SEA_PINES_EYEBROW,
    headlineTop: "Hilton Head,",
    headlineAccent: "Your Way",
    intro:
      "Vacation villas and timeshare weeks across Sea Pines on Hilton Head Island. Rent a getaway or buy the week you return to every year.",
    footerBlurb:
      "Vacation rentals and timeshare sales across Sea Pines on Hilton Head Island.",
    legalName: "Heritage Vacations",
    // Only Heritage has a confirmed public number [scott, 2026-09-08]. The
    // other three stay blank until Scott gives their numbers rather than
    // inheriting Heritage's.
    phoneDisplay: "843.363.5699",
    phoneHref: "tel:8433635699",
  },
  swallowtail: {
    phoneDisplay: "843.363.5699",
    phoneHref: "tel:8433635699",
    wordmarkTop: "Swallowtail",
    wordmarkBottom: "at Sea Pines",
    eyebrow: SEA_PINES_EYEBROW,
    headlineTop: "Swallowtail",
    headlineAccent: "at Sea Pines",
    intro:
      "Villas at Swallowtail, inside the Sea Pines Resort on Hilton Head Island. Rent a week, buy a week, or manage the week you already own.",
    footerBlurb:
      "Villa rentals, timeshare sales and owner services at Swallowtail in Sea Pines.",
    legalName: "Swallowtail at Sea Pines",
  },
  spicebush: {
    phoneDisplay: "843.363.5699",
    phoneHref: "tel:8433635699",
    wordmarkTop: "Spicebush",
    wordmarkBottom: "at Sea Pines",
    eyebrow: SEA_PINES_EYEBROW,
    headlineTop: "Spicebush",
    headlineAccent: "at Sea Pines",
    intro:
      "Villas at Spicebush, inside the Sea Pines Resort on Hilton Head Island. Rent a week, buy a week, or manage the week you already own.",
    footerBlurb:
      "Villa rentals, timeshare sales and owner services at Spicebush in Sea Pines.",
    legalName: "Spicebush at Sea Pines",
  },
};

export const FALLBACK_BRAND = SITE_BRAND.mhht;

export function brandForSlug(slug?: string): SiteBrand {
  return (slug && SITE_BRAND[slug]) || FALLBACK_BRAND;
}
