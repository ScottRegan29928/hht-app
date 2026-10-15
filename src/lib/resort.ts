/**
 * Swallowtail and Spicebush share one design (the "resort" theme, recreated
 * from spicebushatseapines.com / swallowtailatseapines.com, which were the
 * same Avada build). Only content and brand assets differ [scott, 2026-10-08].
 *
 * Per-site CSS keys off `html[data-site]`; per-site assets live under
 * `/brand/<slug>/` with identical file names in both folders.
 */
export const RESORT_SLUGS = ["spicebush", "swallowtail"] as const;
export type ResortSlug = (typeof RESORT_SLUGS)[number];

export function isResort(slug?: string | null): slug is ResortSlug {
  return slug === "spicebush" || slug === "swallowtail";
}

export type ResortInfo = {
  /** Short name used in copy ("Why Own at Spicebush") */
  name: string;
  /** Full name ("Spicebush at Sea Pines") */
  fullName: string;
  email: string;
  /** Street line of the footer address */
  street: string;
  /** Folder under /public with this resort's brand assets */
  assets: string;
};

const INFO: Record<ResortSlug, ResortInfo> = {
  spicebush: {
    name: "Spicebush",
    fullName: "Spicebush at Sea Pines",
    email: "spicebush@cglhhi.com",
    street: "124 N. Sea Pines Drive",
    assets: "/brand/spicebush",
  },
  swallowtail: {
    name: "Swallowtail",
    fullName: "Swallowtail at Sea Pines",
    email: "swallowtail@cglhhi.com",
    street: "70 Lighthouse Road",
    assets: "/brand/swallowtail",
  },
};

export function resortInfo(slug?: string | null): ResortInfo {
  return isResort(slug) ? INFO[slug] : INFO.spicebush;
}
