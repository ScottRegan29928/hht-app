import { useEffect } from "react";
import { useSite } from "./siteContext";

// ── Document head management ──
//
// ⚠ HONEST LIMITATION: this app is a client-rendered SPA, so these tags are
// written by JavaScript after load. Google renders JS and will see them, but
// most social-preview crawlers (Facebook, LinkedIn, Slack, iMessage) do NOT
// execute JS and will only ever read the static tags in index.html. Proper
// per-page Open Graph previews need prerendering or SSR at build time — see
// the note in skills/hht_website. Titles, descriptions and canonicals below
// are still worth setting; per-page social images are the part that will not
// work until then.
//
// robots.txt and sitemap.xml are NOT affected by this: both are served as real
// server responses from Convex via Vercel rewrites.

export type SeoInput = {
  title?: string;
  description?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  /** "article" for blog posts, "website" for everything else. */
  type?: "website" | "article";
  publishedTime?: number;
};

function setMeta(
  attr: "name" | "property",
  key: string,
  content: string | undefined
) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    // Remove rather than blank it — an empty description is worse than none.
    if (el?.dataset.hhtManaged === "1") el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.dataset.hhtManaged = "1";
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"][data-hht-managed="1"]`
  );
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.dataset.hhtManaged = "1";
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Apply page-level SEO, falling back to the site's configured defaults.
 *
 * Pass `undefined` for anything the page does not override; the site default
 * fills it in rather than the tag going missing.
 */
export function useSeo(input: SeoInput) {
  const { scope } = useSite();
  const site = scope?.site;
  const defaults = site?.seoDefaults;

  const {
    title,
    description,
    ogImageUrl,
    canonicalUrl,
    noindex,
    type,
    publishedTime,
  } = input;

  useEffect(() => {
    const siteName = site?.name ?? "Hilton Head Timeshares";
    const suffix = defaults?.titleSuffix ?? ` | ${siteName}`;

    // A page title already ending in the suffix is not double-suffixed.
    const fullTitle = title
      ? title.endsWith(suffix.trim()) || title === siteName
        ? title
        : title + suffix
      : siteName;
    document.title = fullTitle;

    const desc = description ?? defaults?.metaDescription;
    const image = ogImageUrl ?? defaults?.ogImageUrl;

    const canonical =
      canonicalUrl ??
      (site?.domain
        ? `https://${site.domain}${window.location.pathname}`
        : undefined);

    setMeta("name", "description", desc);
    setLink("canonical", canonical);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : undefined);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", type ?? "website");
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:image", image);

    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", image);
    setMeta("name", "twitter:site", defaults?.twitterHandle);

    setMeta(
      "property",
      "article:published_time",
      publishedTime ? new Date(publishedTime).toISOString() : undefined
    );
  }, [
    title,
    description,
    ogImageUrl,
    canonicalUrl,
    noindex,
    type,
    publishedTime,
    site?.name,
    site?.domain,
    defaults?.titleSuffix,
    defaults?.metaDescription,
    defaults?.ogImageUrl,
    defaults?.twitterHandle,
  ]);
}
