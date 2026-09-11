/**
 * Home page content model.
 *
 * The home page layout is designed in code, but every piece of copy and every
 * image in it is editable from the backend [scott, 2026-09-11]. This module is
 * the single source of truth for:
 *   1. what the fields are,
 *   2. what each site's default text/images are, and
 *   3. how a saved record merges over those defaults.
 *
 * The merge is field-by-field and treats empty strings as "unset", so clearing
 * a field in the editor restores the designed default instead of blanking the
 * live site. That is the safer failure mode for a page nobody can see while
 * they type.
 *
 * When you add a field here, add it in three more places or it will not save:
 * `contentPages.homeContent` in convex/schema.ts, `HOME_CONTENT` in
 * convex/content.ts, and the editor in src/components/admin/HomeContentEditor.tsx.
 */

export type HeroContent = {
  eyebrow: string;
  headlineLines: string[];
  intro: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  images: string[];
};

export type TileItem = { label: string; imageUrl: string; href: string };

export type HomeContent = {
  hero: HeroContent;
  tiles: { heading: string; subheading: string; items: TileItem[] };
  map: { heading: string; intro: string };
  communities: { heading: string; subheading: string };
  featured: { heading: string; subheading: string };
  closing: {
    enabled: boolean;
    heading: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
};

/** A saved record: same shape, every field optional. */
export type HomeContentInput = {
  hero?: Partial<Omit<HeroContent, "headlineLines" | "images">> & {
    headlineLines?: string[];
    images?: string[];
  };
  tiles?: {
    heading?: string;
    subheading?: string;
    items?: { label: string; imageUrl?: string; href?: string }[];
  };
  map?: { heading?: string; intro?: string };
  communities?: { heading?: string; subheading?: string };
  featured?: { heading?: string; subheading?: string };
  closing?: Partial<HomeContent["closing"]>;
} | null
  | undefined;

// Rent leads buy everywhere [scott, 2026-09-08].
const RENT_HREF = "/search?type=rent";
const BUY_HREF = "/search?type=buy";

// Amenity keys for the Heritage tiles. Water Views needs the raw HostAway tags
// OR-ed in or it matches 3 properties instead of 37.
const AMENITY_HREF = (keys: string[]) =>
  `${RENT_HREF}&amenities=${encodeURIComponent(keys.join(","))}`;

const HERITAGE_TILES: TileItem[] = [
  {
    label: "Water Views",
    imageUrl: "/tiles/hv/water.jpg",
    href: AMENITY_HREF(["water_views", "Waterview", "Oceanview", "Waterfront", "Lakeview"]),
  },
  { label: "Swimming Pool", imageUrl: "/tiles/hv/swimming-pool.jpg", href: AMENITY_HREF(["pool"]) },
  { label: "Tennis Courts", imageUrl: "/tiles/hv/tennis.jpg", href: AMENITY_HREF(["tennis"]) },
  {
    label: "On Golf Course",
    imageUrl: "/tiles/hv/golf.jpg",
    href: AMENITY_HREF(["on_golf_course", "Golfcoursefront", "Golfcourseview"]),
  },
];

const HERITAGE_SLIDES = [
  "/hero/hv/slide1-lighthouse.jpg",
  "/hero/hv/slide2-bedroom.jpg",
  "/hero/hv/slide3-beach.jpg",
  "/hero/hv/slide4-pool.jpg",
  "/hero/hv/slide5-golf.jpg",
  "/hero/hv/slide6-villa.jpg",
];

function baseDefaults(): HomeContent {
  return {
    hero: {
      eyebrow: "",
      headlineLines: [],
      intro: "",
      primaryLabel: "Find a Rental",
      primaryHref: RENT_HREF,
      secondaryLabel: "Buy a Timeshare Week",
      secondaryHref: BUY_HREF,
      images: [],
    },
    tiles: { heading: "", subheading: "", items: [] },
    map: {
      heading: "Explore Sea Pines",
      intro:
        "Click a community on the map to browse available villas and timeshare weeks.",
    },
    communities: {
      heading: "Communities",
      subheading: "Eight premier neighborhoods in Sea Pines",
    },
    featured: {
      heading: "Featured Villas",
      subheading: "Handpicked properties available now",
    },
    closing: {
      enabled: true,
      heading: "Ready to Own Your Piece of Paradise?",
      body: "Whether you're looking to rent a beautiful villa or purchase a timeshare week, we're here to help you find the perfect fit.",
      primaryLabel: "Find a Rental",
      primaryHref: RENT_HREF,
      secondaryLabel: "Buy a Week",
      secondaryHref: BUY_HREF,
    },
  };
}

/** The designed defaults for one site, before any backend edit. */
export function defaultHomeContent(siteSlug: string): HomeContent {
  const d = baseDefaults();

  if (siteSlug === "heritage") {
    d.hero.headlineLines = [
      "Extraordinary Vacation Rentals",
      "in Hilton Head Island\u2019s",
      "Luxurious Sea Pines Community",
    ];
    d.hero.intro =
      "Discover Sea Pines\u2019 most coveted vacation rentals on Hilton Head Island. From the iconic Harbour Town lighthouse to championship golf and sugar-sand beaches, your perfect coastal retreat awaits you.";
    d.hero.primaryLabel = "Find Your Perfect Rental";
    d.hero.secondaryLabel = "Buy a Week";
    d.hero.images = HERITAGE_SLIDES;
    d.tiles = {
      // The live WordPress site spells this "Persue" — a typo, corrected here.
      heading: "Pursue the Extraordinary",
      subheading:
        "Uncover unforgettable experiences that awaken the spirit and uplift the soul.",
      items: HERITAGE_TILES,
    };
    // Scott had the closing band removed on Heritage, 2026-09-08.
    d.closing.enabled = false;
    return d;
  }

  if (siteSlug === "mhht") {
    // No hero banner: the map section is the hero and carries the headline
    // and intro [scott, 2026-09-10].
    d.map.heading = "Your Island Getaway Awaits";
    d.map.intro =
      "Discover luxury timeshare villas in the heart of Sea Pines. Purchase a week or rent the perfect vacation home on Hilton Head Island. Click a community on the map to browse available villas and timeshare weeks.";
    return d;
  }

  return d;
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? v : undefined; // blank clears back to the default
};

const list = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const cleaned = v.filter((x): x is string => typeof x === "string" && !!x.trim());
  return cleaned.length ? cleaned : undefined;
};

/** Merges a saved record over the site's designed defaults. */
export function resolveHomeContent(
  siteSlug: string,
  saved: HomeContentInput
): HomeContent {
  const d = defaultHomeContent(siteSlug);
  if (!saved) return d;

  const h = saved.hero;
  if (h) {
    d.hero = {
      eyebrow: str(h.eyebrow) ?? d.hero.eyebrow,
      headlineLines: list(h.headlineLines) ?? d.hero.headlineLines,
      intro: str(h.intro) ?? d.hero.intro,
      primaryLabel: str(h.primaryLabel) ?? d.hero.primaryLabel,
      primaryHref: str(h.primaryHref) ?? d.hero.primaryHref,
      secondaryLabel: str(h.secondaryLabel) ?? d.hero.secondaryLabel,
      secondaryHref: str(h.secondaryHref) ?? d.hero.secondaryHref,
      images: list(h.images) ?? d.hero.images,
    };
  }

  if (saved.tiles) {
    const items = saved.tiles.items
      ?.filter((t) => t && t.label?.trim())
      .map((t, i) => ({
        label: t.label,
        imageUrl: str(t.imageUrl) ?? d.tiles.items[i]?.imageUrl ?? "",
        href: str(t.href) ?? d.tiles.items[i]?.href ?? RENT_HREF,
      }));
    d.tiles = {
      heading: str(saved.tiles.heading) ?? d.tiles.heading,
      subheading: str(saved.tiles.subheading) ?? d.tiles.subheading,
      items: items?.length ? items : d.tiles.items,
    };
  }

  if (saved.map) {
    d.map = {
      heading: str(saved.map.heading) ?? d.map.heading,
      intro: str(saved.map.intro) ?? d.map.intro,
    };
  }

  if (saved.communities) {
    d.communities = {
      heading: str(saved.communities.heading) ?? d.communities.heading,
      subheading: str(saved.communities.subheading) ?? d.communities.subheading,
    };
  }

  if (saved.featured) {
    d.featured = {
      heading: str(saved.featured.heading) ?? d.featured.heading,
      subheading: str(saved.featured.subheading) ?? d.featured.subheading,
    };
  }

  if (saved.closing) {
    d.closing = {
      enabled:
        typeof saved.closing.enabled === "boolean"
          ? saved.closing.enabled
          : d.closing.enabled,
      heading: str(saved.closing.heading) ?? d.closing.heading,
      body: str(saved.closing.body) ?? d.closing.body,
      primaryLabel: str(saved.closing.primaryLabel) ?? d.closing.primaryLabel,
      primaryHref: str(saved.closing.primaryHref) ?? d.closing.primaryHref,
      secondaryLabel:
        str(saved.closing.secondaryLabel) ?? d.closing.secondaryLabel,
      secondaryHref: str(saved.closing.secondaryHref) ?? d.closing.secondaryHref,
    };
  }

  return d;
}
