import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Content management: pages, blog posts, SEO ──
//
// Scott's MVP item 2. Every record is scoped to a single site by `siteSlug`;
// the four sister sites share one backend but never share marketing copy.
//
// Public queries return published records only. Draft content is reachable
// exclusively through the admin queries, which require an admin role.

const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];

const SEO_FIELDS = v.object({
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  ogImageUrl: v.optional(v.string()),
  canonicalUrl: v.optional(v.string()),
  noindex: v.optional(v.boolean()),
});

async function requireAdminProfile(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"userProfiles">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

/**
 * Normalize a user-supplied slug into a safe url segment.
 *
 * Admins type titles like "Things To Do" into the slug box, so this has to be
 * forgiving rather than strict — a rejected save with a validation message is
 * worse UX than quietly producing "things-to-do".
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Route segments the SPA already owns. A content page may not take one of
 * these, or it would shadow the real route and be unreachable.
 */
const RESERVED_SLUGS = new Set([
  // "home" belongs to the seeded home-page record; the live URL is "/".
  "home",
  "search",
  "property",
  "community",
  "checkout",
  "blog",
  "owner",
  "management",
  "api",
  "assets",
]);

function excerptFrom(body: string, explicit?: string): string | undefined {
  if (explicit && explicit.trim()) return explicit.trim();
  // Strip the most common markdown markers so the auto-excerpt reads as prose
  // rather than as syntax.
  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  return plain.length > 180 ? plain.slice(0, 177).trimEnd() + "…" : plain;
}

// ─────────────────────────── public: pages ───────────────────────────

export const getPage = query({
  args: { siteSlug: v.string(), slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("contentPages")
      .withIndex("by_site_slug", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("slug", args.slug)
      )
      .first();
    if (!page || page.status !== "published") return null;
    // The home record renders at "/" through the designed homepage, not as a
    // content page at "/home".
    if (page.isHome) return null;
    return page;
  },
});

export const listNavPages = query({
  args: { siteSlug: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("contentPages")
      .withIndex("by_site_status", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("status", "published")
      )
      .collect();
    return pages
      .filter((p) => p.showInNav)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
          a.title.localeCompare(b.title)
      )
      .map((p) => ({
        slug: p.slug,
        label: p.navLabel?.trim() || p.title,
      }));
  },
});

// ─────────────────────────── public: blog ───────────────────────────

export const listPosts = query({
  args: {
    siteSlug: v.string(),
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_site_status", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("status", "published")
      )
      .collect();
    const filtered = args.tag
      ? posts.filter((p) => (p.tags ?? []).includes(args.tag!))
      : posts;
    return filtered
      .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))
      .slice(0, args.limit ?? 50)
      .map((p) => ({
        _id: p._id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        coverImageUrl: p.coverImageUrl,
        authorName: p.authorName,
        tags: p.tags ?? [],
        publishedAt: p.publishedAt ?? p.createdAt,
      }));
  },
});

export const getPost = query({
  args: { siteSlug: v.string(), slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_site_slug", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("slug", args.slug)
      )
      .first();
    if (!post || post.status !== "published") return null;
    return post;
  },
});

export const listTags = query({
  args: { siteSlug: v.string() },
  returns: v.array(v.object({ tag: v.string(), count: v.number() })),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_site_status", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("status", "published")
      )
      .collect();
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  },
});

// ─────────────────────────── admin: pages ───────────────────────────

export const adminListPages = query({
  args: { siteSlug: v.optional(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const all = args.siteSlug
      ? await ctx.db
          .query("contentPages")
          .withIndex("by_site_slug", (q) => q.eq("siteSlug", args.siteSlug!))
          .collect()
      : await ctx.db.query("contentPages").collect();
    return all.sort(
      (a, b) =>
        a.siteSlug.localeCompare(b.siteSlug) ||
        (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
        a.title.localeCompare(b.title)
    );
  },
});

export const adminGetPage = query({
  args: { pageId: v.id("contentPages") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    return await ctx.db.get(args.pageId);
  },
});

export const savePage = mutation({
  args: {
    pageId: v.optional(v.id("contentPages")),
    siteSlug: v.string(),
    slug: v.string(),
    title: v.string(),
    body: v.string(),
    excerpt: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    showInNav: v.boolean(),
    navLabel: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    seo: v.optional(SEO_FIELDS),
  },
  returns: v.object({ pageId: v.id("contentPages"), slug: v.string() }),
  handler: async (ctx, args) => {
    const profile = await requireAdminProfile(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");

    // The home record keeps its slug and stays out of the nav; only its
    // title and SEO are editable [scott, 2026-09-10].
    const editing = args.pageId ? await ctx.db.get(args.pageId) : null;
    if (editing?.isHome) {
      await ctx.db.patch(editing._id, {
        title,
        status: args.status,
        seo: args.seo,
        updatedAt: Date.now(),
        updatedByName: profile.displayName,
      });
      return { pageId: editing._id, slug: "home" };
    }

    const slug = normalizeSlug(args.slug || title);
    if (!slug) throw new Error("Could not build a url from that title — set a slug manually");
    if (RESERVED_SLUGS.has(slug)) {
      throw new Error(`"/${slug}" is reserved by the site itself — choose another url`);
    }

    // Slug must be unique within the site, ignoring the record being edited.
    const clash = await ctx.db
      .query("contentPages")
      .withIndex("by_site_slug", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("slug", slug)
      )
      .first();
    if (clash && clash._id !== args.pageId) {
      throw new Error(`This site already has a page at "/${slug}"`);
    }

    const now = Date.now();
    const fields = {
      siteSlug: args.siteSlug,
      slug,
      title,
      body: args.body,
      excerpt: excerptFrom(args.body, args.excerpt),
      status: args.status,
      showInNav: args.showInNav,
      navLabel: args.navLabel?.trim() || undefined,
      sortOrder: args.sortOrder,
      seo: args.seo,
      updatedAt: now,
      updatedByName: profile.displayName ?? profile.email,
    };

    if (args.pageId) {
      const existing = await ctx.db.get(args.pageId);
      if (!existing) throw new Error("Page not found");
      await ctx.db.patch(args.pageId, {
        ...fields,
        // Stamp publishedAt the first time it actually goes live, and leave it
        // alone on later edits so the public date does not jump around.
        publishedAt:
          args.status === "published"
            ? existing.publishedAt ?? now
            : existing.publishedAt,
      });
      return { pageId: args.pageId, slug };
    }

    const pageId = await ctx.db.insert("contentPages", {
      ...fields,
      publishedAt: args.status === "published" ? now : undefined,
      createdAt: now,
    });
    return { pageId, slug };
  },
});

export const deletePage = mutation({
  args: { pageId: v.id("contentPages") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const page = await ctx.db.get(args.pageId);
    if (!page) return { deleted: false };
    if (page.isHome) throw new Error("The home page cannot be deleted.");
    await ctx.db.delete(args.pageId);
    return { deleted: true };
  },
});

// ─────────────────────────── admin: blog ───────────────────────────

export const adminListPosts = query({
  args: { siteSlug: v.optional(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const all = args.siteSlug
      ? await ctx.db
          .query("blogPosts")
          .withIndex("by_site_slug", (q) => q.eq("siteSlug", args.siteSlug!))
          .collect()
      : await ctx.db.query("blogPosts").collect();
    return all.sort(
      (a, b) =>
        a.siteSlug.localeCompare(b.siteSlug) ||
        (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt)
    );
  },
});

export const adminGetPost = query({
  args: { postId: v.id("blogPosts") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    return await ctx.db.get(args.postId);
  },
});

export const savePost = mutation({
  args: {
    postId: v.optional(v.id("blogPosts")),
    siteSlug: v.string(),
    slug: v.string(),
    title: v.string(),
    body: v.string(),
    excerpt: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    authorName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("published")),
    seo: v.optional(SEO_FIELDS),
  },
  returns: v.object({ postId: v.id("blogPosts"), slug: v.string() }),
  handler: async (ctx, args) => {
    const profile = await requireAdminProfile(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");

    const slug = normalizeSlug(args.slug || title);
    if (!slug) throw new Error("Could not build a url from that title — set a slug manually");

    const clash = await ctx.db
      .query("blogPosts")
      .withIndex("by_site_slug", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("slug", slug)
      )
      .first();
    if (clash && clash._id !== args.postId) {
      throw new Error(`This site already has a post at "/blog/${slug}"`);
    }

    const now = Date.now();
    const tags = (args.tags ?? [])
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const fields = {
      siteSlug: args.siteSlug,
      slug,
      title,
      body: args.body,
      excerpt: excerptFrom(args.body, args.excerpt),
      coverImageUrl: args.coverImageUrl?.trim() || undefined,
      authorName: args.authorName?.trim() || undefined,
      tags: tags.length ? tags : undefined,
      status: args.status,
      seo: args.seo,
      updatedAt: now,
      updatedByName: profile.displayName ?? profile.email,
    };

    if (args.postId) {
      const existing = await ctx.db.get(args.postId);
      if (!existing) throw new Error("Post not found");
      await ctx.db.patch(args.postId, {
        ...fields,
        publishedAt:
          args.status === "published"
            ? existing.publishedAt ?? now
            : existing.publishedAt,
      });
      return { postId: args.postId, slug };
    }

    const postId = await ctx.db.insert("blogPosts", {
      ...fields,
      publishedAt: args.status === "published" ? now : undefined,
      createdAt: now,
    });
    return { postId, slug };
  },
});

export const deletePost = mutation({
  args: { postId: v.id("blogPosts") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) return { deleted: false };
    await ctx.db.delete(args.postId);
    return { deleted: true };
  },
});

// ─────────────────────────── admin: SEO defaults ───────────────────────────

export const saveSeoDefaults = mutation({
  args: {
    siteId: v.id("sites"),
    titleSuffix: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");
    await ctx.db.patch(args.siteId, {
      seoDefaults: {
        titleSuffix: args.titleSuffix?.trim() || undefined,
        metaDescription: args.metaDescription?.trim() || undefined,
        ogImageUrl: args.ogImageUrl?.trim() || undefined,
        twitterHandle: args.twitterHandle?.trim() || undefined,
      },
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Everything the sitemap needs for one site, in one read.
 *
 * Served from an HTTP action rather than rendered in the client, so crawlers
 * get real XML instead of an empty SPA shell.
 */
export const sitemapData = query({
  args: { siteSlug: v.string() },
  returns: v.object({
    domain: v.union(v.string(), v.null()),
    pages: v.array(v.object({ slug: v.string(), updatedAt: v.number() })),
    posts: v.array(v.object({ slug: v.string(), updatedAt: v.number() })),
    properties: v.array(v.object({ slug: v.string(), updatedAt: v.number() })),
    communities: v.array(v.object({ slug: v.string() })),
  }),
  handler: async (ctx, args) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.siteSlug))
      .first();

    const pages = (
      await ctx.db
        .query("contentPages")
        .withIndex("by_site_status", (q) =>
          q.eq("siteSlug", args.siteSlug).eq("status", "published")
        )
        .collect()
    )
      .filter((p) => !p.seo?.noindex)
      .map((p) => ({ slug: p.slug, updatedAt: p.updatedAt ?? p.createdAt }));

    const posts = (
      await ctx.db
        .query("blogPosts")
        .withIndex("by_site_status", (q) =>
          q.eq("siteSlug", args.siteSlug).eq("status", "published")
        )
        .collect()
    )
      .filter((p) => !p.seo?.noindex)
      .map((p) => ({ slug: p.slug, updatedAt: p.updatedAt ?? p.createdAt }));

    // Property and community urls are scoped exactly like the public listing
    // queries, so a site never advertises inventory it does not show.
    const communityIds = new Set<Id<"communities">>();
    let communities: Array<Doc<"communities">> = [];
    if (site && site.scopeMode === "communities") {
      const wanted = new Set(site.communitySlugs ?? []);
      communities = (await ctx.db.query("communities").collect()).filter((c) =>
        wanted.has(c.slug)
      );
    } else {
      communities = await ctx.db.query("communities").collect();
    }
    for (const c of communities) communityIds.add(c._id);

    const properties = (await ctx.db.query("properties").collect())
      .filter((p) => communityIds.has(p.communityId))
      .map((p) => ({ slug: p.slug, updatedAt: p._creationTime }));

    return {
      domain: site?.domain ?? null,
      pages,
      posts,
      properties,
      communities: communities.map((c) => ({ slug: c.slug })),
    };
  },
});

// ─────────────────────── home page (title + SEO only) ───────────────────────

/**
 * The home page's editable fields. The homepage layout itself is designed in
 * code, so this record deliberately carries title/SEO only — there is no
 * markdown body in play, and the admin editor hides the body for it rather
 * than showing a field that does nothing [scott, 2026-09-10].
 */
export const getHomeMeta = query({
  args: { siteSlug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("contentPages")
      .withIndex("by_site_slug", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("slug", "home")
      )
      .first();
    if (!page || !page.isHome || page.status !== "published") return null;
    return { title: page.title, seo: page.seo ?? {} };
  },
});

/**
 * Creates the missing home-page record for every active site. Idempotent, so
 * it is safe to re-run after adding a site.
 */
export const seedHomePages = internalMutation({
  args: {},
  returns: v.object({ created: v.array(v.string()), existing: v.array(v.string()) }),
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    const created: string[] = [];
    const existing: string[] = [];

    for (const site of sites) {
      const found = await ctx.db
        .query("contentPages")
        .withIndex("by_site_slug", (q) =>
          q.eq("siteSlug", site.slug).eq("slug", "home")
        )
        .first();
      if (found) {
        if (!found.isHome) await ctx.db.patch(found._id, { isHome: true });
        existing.push(site.slug);
        continue;
      }
      await ctx.db.insert("contentPages", {
        siteSlug: site.slug,
        slug: "home",
        isHome: true,
        title: site.name,
        body: "",
        status: "published",
        showInNav: false,
        sortOrder: 0,
        seo: {
          metaTitle: site.name,
          metaDescription: site.seoDefaults?.metaDescription ?? site.tagline,
          ogImageUrl: site.seoDefaults?.ogImageUrl,
        },
        createdAt: Date.now(),
      });
      created.push(site.slug);
    }
    return { created, existing };
  },
});
