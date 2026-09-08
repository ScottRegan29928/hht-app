import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSiteFlags } from "../lib/siteContext";
import { useSeo } from "../lib/seo";
import { Markdown } from "../lib/markdown";
import { ArrowLeft } from "lucide-react";

/**
 * Renders an admin-authored content page at "/:slug".
 *
 * This is the catch-all route, so it doubles as the site's 404: an unknown
 * slug is simply a page that does not exist. It must stay last in the route
 * list or it will shadow /search, /blog and the rest.
 */
export function ContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { siteSlug } = useSiteFlags();
  const page = useQuery(api.content.getPage, {
    siteSlug,
    slug: slug ?? "",
  });

  useSeo({
    title: page?.seo?.metaTitle || page?.title,
    description: page?.seo?.metaDescription || page?.excerpt,
    ogImageUrl: page?.seo?.ogImageUrl,
    canonicalUrl: page?.seo?.canonicalUrl,
    // An unresolved or missing page must not be indexed.
    noindex: page?.seo?.noindex ?? page === null,
  });

  if (page === undefined) {
    return (
      <>
        <div className="flex items-center justify-center py-24">
          <div className="animate-pulse text-muted-foreground">Loading…</div>
        </div>
      </>
    );
  }

  if (page === null) {
    return (
      <>
        <main className="flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-md">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
              Page not found
            </p>
            <h1 className="text-3xl font-bold mb-4 tracking-tight">
              We couldn't find that page
            </h1>
            <p className="text-muted-foreground mb-8">
              The link may be out of date, or the page may have moved.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main>
        <article className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
            {page.title}
          </h1>
          <Markdown source={page.body} />
        </article>
      </main>
    </>
  );
}
