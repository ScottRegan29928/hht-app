import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSiteFlags } from "../lib/siteContext";
import { useSeo } from "../lib/seo";
import { Markdown } from "../lib/markdown";
import { ArrowLeft, Calendar, Clock, Key, User } from "lucide-react";
import { blogBase } from "../lib/blogPaths";
import { isResort, resortInfo } from "@/lib/resort";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Same formula as the old spicebushatseapines.com read-time line: words / 200,
// one decimal ("9.3 min read") [zoe, 2026-10-01].
export function readMinutes(markdown: string): string {
  const text = markdown
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#*>\[\]()_`-]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0.1, words / 200).toFixed(1);
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { siteSlug } = useSiteFlags();
  const post = useQuery(api.content.getPost, { siteSlug, slug: slug ?? "" });

  useSeo({
    title: post?.seo?.metaTitle || post?.title,
    description: post?.seo?.metaDescription || post?.excerpt,
    ogImageUrl: post?.seo?.ogImageUrl || post?.coverImageUrl,
    canonicalUrl: post?.seo?.canonicalUrl,
    noindex: post?.seo?.noindex ?? post === null,
    type: "article",
    publishedTime: post?.publishedAt,
  });

  if (post === undefined) {
    return (
      <>
        <div className="flex items-center justify-center py-24">
          <div className="animate-pulse text-muted-foreground">Loading…</div>
        </div>
      </>
    );
  }

  if (post === null) {
    return (
      <>
        <main className="flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4 tracking-tight">
              Article not found
            </h1>
            <p className="text-muted-foreground mb-8">
              This article may have been unpublished or moved.
            </p>
            <Link
              to={blogBase(siteSlug)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All articles
            </Link>
          </div>
        </main>
      </>
    );
  }

  // Spicebush mirrors spicebushatseapines.com: featured image first, then a
  // slightly smaller title [zoe, 2026-10-01].
  const imageFirst = isResort(siteSlug);
  const cover = post.coverImageUrl ? (
    <img
      src={post.coverImageUrl}
      alt={post.title}
      className="w-full rounded-xl mb-8 aspect-[16/9] object-cover bg-muted"
    />
  ) : null;

  return (
    <>
      <main>
        <article
          className={`sb-articles max-w-3xl mx-auto px-4 pb-12 md:pb-16 ${
            imageFirst ? "pt-6 md:pt-8" : "pt-12 md:pt-16"
          }`}
        >
          <Link
            to={blogBase(siteSlug)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            All articles
          </Link>

          {imageFirst && cover}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.map((t: string) => (
                <span
                  key={t}
                  className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <h1
            className={
              imageFirst
                ? "text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-4"
                : "text-4xl md:text-5xl font-bold tracking-tight mb-4"
            }
          >
            {post.title}
          </h1>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b [&>span]:whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(post.publishedAt ?? post.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {readMinutes(post.body)} min read
            </span>
            {post.authorName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.authorName}
              </span>
            )}
          </div>

          {!imageFirst && cover}

          <Markdown source={post.body} />

        </article>
        {imageFirst && <SpicebushArticleCta name={resortInfo(siteSlug).name} />}
      </main>
    </>
  );
}

/**
 * Closing call to action under every Spicebush article: same copy on all of
 * them, on the old site's sand photo with the site's maroon + blue buttons
 * [zoe, 2026-10-01]. Reuses the homepage closing band's classes
 * (sb-sand-section sb-closing) so the button styling stays in one place.
 */
function SpicebushArticleCta({ name }: { name: string }) {
  return (
    <aside className="sb-sand-section sb-closing sb-article-cta sb-articles w-full text-center px-6 sm:px-10">
      <div className="max-w-3xl mx-auto">
      <h2 className="text-[2rem] sm:text-[2.625rem] leading-tight font-bold text-balance">
        Make{" "}
        <span className="font-[family-name:Brushine] font-normal tracking-normal normal-case text-[3rem] sm:text-[4rem] leading-none">
          {name}
        </span>{" "}
        Your Place in Sea Pines
      </h2>
      <p className="mt-4 text-base sm:text-lg max-w-xl mx-auto">
        Every {name} villa is a 2 bedroom, 2 bath retreat in the heart of
        Sea Pines. Rent one for your next Hilton Head getaway, or own a week and
        make the island part of every year.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
        <Link
          to="/search?type=rent"
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Find a Rental
        </Link>
        <Link
          to="/search?type=buy"
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 border-2 rounded-lg font-semibold transition-colors"
        >
          <Key className="w-4 h-4" />
          Buy a Week
        </Link>
      </div>
      </div>
    </aside>
  );
}
