/**
 * Owner portal design tokens.
 *
 * Scott, 2026-09-12: "improve the design of the owner's portal to make it more
 * engaging. A little color would be beneficial... Look at the LeadWorks Intent
 * portal for design inspiration."
 *
 * What is borrowed from the Intent portal (viktor-spaces/.../portal.css):
 *  - a warm sunk canvas under white cards rather than flat gray-on-gray;
 *  - color used to *classify*, never to decorate: a listing kind, a status, a
 *    match alert. Ordinary buttons stay in the brand color;
 *  - exactly two elevations — cards barely lift, overlays lift a lot;
 *  - status colors kept distinct from brand colors so "live" and "urgent"
 *    never blur together.
 *
 * What is deliberately different: Intent is one product with one palette, while
 * this portal serves two sister resorts that owners can move between (the
 * marketplace is joint). So each resort carries its own accent — an owner
 * should be able to tell at a glance which portal they are looking at — over a
 * shared Sea Pines teal that keeps them recognisably siblings.
 */

export type ResortTheme = {
  /** Deep brand color: sidebar, primary buttons, headings. */
  ink: string;
  inkDeep: string;
  /** The resort's own accent, used for highlights and active states. */
  accent: string;
  accentSoft: string;
  accentInk: string;
  /** Name for the sidebar eyebrow. */
  label: string;
};

/**
 * Accents are drawn from each resort's namesake rather than invented:
 * spicebush is a shrub with red berries, swallowtails are marigold butterflies.
 * Both sit on the shared Sea Pines teal.
 */
export const RESORT_THEMES: Record<string, ResortTheme> = {
  spicebush: {
    ink: "#0E4C5A",
    inkDeep: "#0A3742",
    accent: "#B4472F",
    accentSoft: "#FBEDE9",
    accentInk: "#8E3623",
    label: "Spicebush at Sea Pines",
  },
  swallowtail: {
    ink: "#0E4C5A",
    inkDeep: "#0A3742",
    accent: "#B07A16",
    accentSoft: "#FDF3E0",
    accentInk: "#8A5F10",
    label: "Swallowtail at Sea Pines",
  },
};

export const DEFAULT_THEME: ResortTheme = {
  ink: "#0E4C5A",
  inkDeep: "#0A3742",
  accent: "#0E7490",
  accentSoft: "#E6F4F7",
  accentInk: "#0B5A70",
  label: "Owner Portal",
};

export function resortTheme(siteSlug?: string): ResortTheme {
  return (siteSlug && RESORT_THEMES[siteSlug]) || DEFAULT_THEME;
}

/** CSS custom properties for the portal shell, set from the resort theme. */
export function themeVars(t: ResortTheme): React.CSSProperties {
  return {
    ["--po-ink" as any]: t.ink,
    ["--po-ink-deep" as any]: t.inkDeep,
    ["--po-accent" as any]: t.accent,
    ["--po-accent-soft" as any]: t.accentSoft,
    ["--po-accent-ink" as any]: t.accentInk,
  };
}

/**
 * Listing kinds get their own color so a mixed list is scannable without
 * reading every card. Selling / buying / swapping are three different
 * intentions and should not all be brand teal.
 */
export const KIND_STYLES: Record<
  string,
  { label: string; chip: string; dot: string; text: string; ring: string }
> = {
  for_sale: {
    label: "For sale",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-600",
    text: "text-emerald-800",
    ring: "ring-emerald-200",
  },
  want_to_buy: {
    label: "Wanted",
    chip: "bg-sky-50 text-sky-800 border-sky-200",
    dot: "bg-sky-600",
    text: "text-sky-800",
    ring: "ring-sky-200",
  },
  trade: {
    label: "Trade",
    chip: "bg-amber-50 text-amber-900 border-amber-200",
    dot: "bg-amber-600",
    text: "text-amber-900",
    ring: "ring-amber-200",
  },
};

export const COMMUNITY_LABELS: Record<string, string> = {
  spicebush: "Spicebush",
  "swallowtail-at-sea-pines": "Swallowtail",
};
