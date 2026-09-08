import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ── Prerender metadata resolver ──
//
// This app is a client-rendered SPA. Google executes JS and sees the tags that
// src/lib/seo.ts writes, but social-preview crawlers (Facebook, LinkedIn,
// Slack, iMessage, WhatsApp, X) do NOT run JS and would only ever read the
// static tags in index.html — so every shared link previewed as the generic
// homepage blurb regardless of which page was shared.
//
// This query resolves a URL path to the same title/description/image that the
// client would compute, and convex/http.ts wraps the result in a real HTML
// document. Vercel routes crawler user-agents to that endpoint.
//
// ⚠ The values here MUST stay in step with src/lib/seo.ts and the useSeo()
// calls in the page components. If a crawler is served a title or description
// that a human visitor never sees, that is cloaking. Anything added to one
// side belongs on the other.

const MAX_DESC = 300;

function clean(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  // Content bodies are markdown; strip the syntax so a description never
  // shows raw ## or [link](url) noise in a share card.
  const stripped = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return undefined;
  return stripped.length > MAX_DESC
    ? stripped.slice(0, MAX_DESC - 1).trimEnd() + "…"
    : stripped;
}

export type PrerenderMeta = {
  title: string;
  description?: string;
  image?: string;
  canonical?: string;
  type: "website" | "article";
  noindex: boolean;
  siteName: string;
  publishedTime?: string;
  /** Visible content for the crawler's document body. */
  heading: string;
  body: string[];
  status: number;
};

export const metaForPath = query({
  args: { siteSlug: v.string(), path: v.string() },
  returns: v.object({
    title: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    canonical: v.optional(v.string()),
    type: v.union(v.literal("website"), v.literal("article")),
    noindex: v.boolean(),
    siteName: v.string(),
    publishedTime: v.optional(v.string()),
    heading: v.string(),
    body: v.array(v.string()),
    status: v.number(),
  }),
  handler: async (ctx, args): Promise<PrerenderMeta> => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.siteSlug))
      .first();

    const siteName = site?.name ?? "Hilton Head Timeshares";
    const defaults = site?.seoDefaults;
    const suffix = defaults?.titleSuffix ?? ` | ${siteName}`;
    const domain = site?.domain;

    // Normalise: strip query/hash, collapse trailing slash.
    let path = args.path.split("?")[0].split("#")[0];
    if (!path.startsWith("/")) path = "/" + path;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    const canonicalFor = (p: string) =>
      domain ? `https://${domain}${p === "/" ? "/" : p}` : undefined;

    const withSuffix = (t: string) =>
      t === siteName || t.endsWith(suffix.trim()) ? t : t + suffix;

    const base = {
      siteName,
      image: defaults?.ogImageUrl,
      canonical: canonicalFor(path),
      type: "website" as const,
      noindex: false,
      status: 200,
    };

    const notFound = (): PrerenderMeta => ({
      ...base,
      title: withSuffix("Page not found"),
      description: undefined,
      // A missing page must never be indexed, and must not return 200 to a
      // crawler — that is how soft-404s get into the index.
      noindex: true,
      status: 404,
      heading: "Page not found",
      body: ["We couldn't find that page."],
    });

    const seg = path.split("/").filter(Boolean);

    // ── Home ──
    if (seg.length === 0) {
      return {
        ...base,
        title: siteName,
        description: clean(defaults?.metaDescription) ?? site?.tagline,
        heading: siteName,
        body: [site?.tagline, clean(defaults?.metaDescription)].filter(
          (x): x is string => !!x
        ),
      };
    }

    // ── Gated surfaces: never describe these to a crawler ──
    if (["owner", "management", "checkout"].includes(seg[0])) {
      return {
        ...base,
        title: withSuffix(seg[0] === "owner" ? "Owner Portal" : "Sign In"),
        noindex: true,
        heading: "Sign in required",
        body: ["This area requires a login."],
      };
    }

    if (seg[0] === "search") {
      return {
        ...base,
        title: withSuffix("Search Properties"),
        description:
          clean(defaults?.metaDescription) ??
          `Search available villas and weeks at ${siteName}.`,
        heading: "Search Properties",
        body: [`Search available villas and weeks at ${siteName}.`],
      };
    }

    // ── Blog index ──
    if (seg[0] === "blog" && seg.length === 1) {
      const desc = `Rental tips, island guides and community news from ${siteName}.`;
      return {
        ...base,
        title: withSuffix("News & Island Guides"),
        description: desc,
        heading: "News & Island Guides",
        body: [desc],
      };
    }

    // ── Blog post ──
    if (seg[0] === "blog" && seg.length === 2) {
      const post = await ctx.db
        .query("blogPosts")
        .withIndex("by_site_slug", (q) =>
          q.eq("siteSlug", args.siteSlug).eq("slug", seg[1])
        )
        .first();
      if (!post || post.status !== "published") return notFound();
      return {
        ...base,
        title: withSuffix(post.seo?.metaTitle || post.title),
        description:
          clean(post.seo?.metaDescription) ??
          clean(post.excerpt) ??
          clean(post.body),
        image: post.seo?.ogImageUrl || post.coverImageUrl || base.image,
        canonical: post.seo?.canonicalUrl ?? base.canonical,
        type: "article",
        noindex: post.seo?.noindex ?? false,
        publishedTime: post.publishedAt
          ? new Date(post.publishedAt).toISOString()
          : undefined,
        heading: post.title,
        body: [clean(post.excerpt), clean(post.body)].filter(
          (x): x is string => !!x
        ),
      };
    }

    // ── Community ──
    if (seg[0] === "community" && seg.length === 2) {
      const community = await ctx.db
        .query("communities")
        .withIndex("by_slug", (q) => q.eq("slug", seg[1]))
        .first();
      // Scoped exactly like the public queries: a site must not render a page
      // for a community it is not allowed to show.
      if (!community || !(await isAllowed(ctx, site, community._id))) {
        return notFound();
      }
      const desc =
        clean(community.shortDescription) ?? clean(community.description);
      return {
        ...base,
        title: withSuffix(community.name),
        description: desc ?? clean(defaults?.metaDescription),
        heading: community.name,
        body: [desc].filter((x): x is string => !!x),
      };
    }

    // ── Property ──
    if (seg[0] === "property" && seg.length === 2) {
      const property = await ctx.db
        .query("properties")
        .withIndex("by_slug", (q) => q.eq("slug", seg[1]))
        .first();
      if (
        !property ||
        !property.isActive ||
        !(await isAllowed(ctx, site, property.communityId))
      ) {
        return notFound();
      }
      const community = await ctx.db.get(property.communityId);
      const bits = [
        `${property.bedrooms} bedroom`,
        `${property.bathrooms} bath`,
        property.sleeps ? `sleeps ${property.sleeps}` : undefined,
      ].filter(Boolean);
      const summary = `${property.address}${
        community ? " in " + community.name : ""
      } — ${bits.join(", ")}. Hilton Head Island, SC.`;

      // Prefer the primary photo, then any gallery photo, then the site default.
      let image: string | undefined;
      const primary = await ctx.db
        .query("propertyPhotos")
        .withIndex("by_primary", (q) =>
          q.eq("propertyId", property._id).eq("isPrimary", true)
        )
        .first();
      const photo =
        primary ??
        (await ctx.db
          .query("propertyPhotos")
          .withIndex("by_property", (q) => q.eq("propertyId", property._id))
          .first());
      if (photo?.storageId) {
        image = (await ctx.storage.getUrl(photo.storageId)) ?? undefined;
      }
      if (!image) image = photo?.externalUrl ?? property.photoUrls?.[0];

      return {
        ...base,
        title: withSuffix(property.address),
        description: clean(property.description) ?? summary,
        image: image ?? base.image,
        heading: property.address,
        body: [summary, clean(property.description)].filter(
          (x): x is string => !!x
        ),
      };
    }

    // ── Content page (the /:slug catch-all) ──
    if (seg.length === 1) {
      const page = await ctx.db
        .query("contentPages")
        .withIndex("by_site_slug", (q) =>
          q.eq("siteSlug", args.siteSlug).eq("slug", seg[0])
        )
        .first();
      if (!page || page.status !== "published") return notFound();
      return {
        ...base,
        title: withSuffix(page.seo?.metaTitle || page.title),
        description:
          clean(page.seo?.metaDescription) ??
          clean(page.excerpt) ??
          clean(page.body),
        image: page.seo?.ogImageUrl || base.image,
        canonical: page.seo?.canonicalUrl ?? base.canonical,
        noindex: page.seo?.noindex ?? false,
        heading: page.title,
        body: [clean(page.excerpt), clean(page.body)].filter(
          (x): x is string => !!x
        ),
      };
    }

    return notFound();
  },
});

/** Mirrors allowedCommunityIds() in convex/sites.ts. */
async function isAllowed(
  ctx: { db: any },
  site: Doc<"sites"> | null,
  communityId: Id<"communities">
): Promise<boolean> {
  if (!site || site.scopeMode !== "communities") return true;
  const wanted = new Set(site.communitySlugs ?? []);
  const community = await ctx.db.get(communityId);
  return !!community && wanted.has(community.slug);
}
