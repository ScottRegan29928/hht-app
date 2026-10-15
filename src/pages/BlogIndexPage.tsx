import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSiteFlags } from "../lib/siteContext";
import { useSeo } from "../lib/seo";
import { Calendar, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";
import { readMinutes } from "./BlogPostPage";
import { ARTICLES_PER_PAGE, blogBase } from "../lib/blogPaths";
import { isResort, resortInfo } from "@/lib/resort";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogIndexPage() {
  const { siteSlug, siteName } = useSiteFlags();
  const [tag, setTag] = useState<string | null>(null);
  const posts = useQuery(api.content.listPosts, {
    siteSlug,
    tag: tag ?? undefined,
    limit: 1000,
  });
  const tags = useQuery(api.content.listTags, { siteSlug });
  const base = blogBase(siteSlug);
  const isArticles = isResort(siteSlug);
  const heading = isArticles ? "Articles" : "News & Island Guides";

  // Numbered pages of 15 instead of one long scroll [zoe, 2026-10-01].
  // The page lives in ?page= so it survives refresh, back and sharing.
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil((posts?.length ?? 0) / ARTICLES_PER_PAGE));
  const requested = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Math.min(Math.max(1, isNaN(requested) ? 1 : requested), totalPages);
  const pagePosts = (posts ?? []).slice(
    (page - 1) * ARTICLES_PER_PAGE,
    page * ARTICLES_PER_PAGE
  );
  const goTo = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    setSearchParams(next);
  };
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page]);

  useSeo({
    title: page > 1 ? `${heading} (Page ${page})` : heading,
    description: isArticles
      ? `Island guides, Sea Pines things to do and vacation ideas from ${siteName}.`
      : `Rental tips, island guides and community news from ${siteName}.`,
  });

  return (
    <>
      <main className="sb-articles sb-sand-top">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <header className="mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
              {heading}
            </h1>
            <p className="text-muted-foreground text-lg">
              {isArticles
                ? "Island guides, things to do in Sea Pines, and ideas for your next Hilton Head vacation."
                : "Sea Pines news, rental tips and things to do on Hilton Head Island."}
            </p>
          </header>

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              <button
                onClick={() => { setTag(null); goTo(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  tag === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                }`}
              >
                All
              </button>
              {tags.map((t) => (
                <button
                  key={t.tag}
                  onClick={() => { setTag(t.tag); goTo(1); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    tag === t.tag
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {t.tag}
                  <span className="ml-1.5 opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {posts === undefined ? (
            <div className="animate-pulse text-muted-foreground py-12">
              Loading…
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center border rounded-xl bg-muted/30">
              <p className="text-muted-foreground">
                No articles published yet.
              </p>
            </div>
          ) : (
            <>
            <div className={`grid gap-8 md:grid-cols-2 ${isArticles ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
              {pagePosts.map((post: any) => (
                <Link
                  key={post._id}
                  to={`${base}/${post.slug}`}
                  className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-xl"
                >
                  {post.coverImageUrl && (
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      <img
                        src={post.coverImageUrl}
                        alt={post.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.tags.slice(0, 3).map((t: string) => (
                          <span
                            key={t}
                            className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(post.publishedAt)}
                      </span>
                      {post.authorName && (
                        <span className={`${isArticles ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-1.5`}>
                          <User className="w-3.5 h-3.5" />
                          {post.authorName}
                        </span>
                      )}
                      {isArticles && <MobileReadTime siteSlug={siteSlug} slug={post.slug} />}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onGo={goTo} />
            )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Pagination({
  page,
  totalPages,
  onGo,
}: {
  page: number;
  totalPages: number;
  onGo: (n: number) => void;
}) {
  const btn =
    // Same look as the search page's amenity chips (sb-chip) [zoe, 2026-10-01].
    "sb-chip min-w-10 h-10 px-3 inline-flex items-center justify-center rounded-lg border text-sm font-medium transition-colors";
  const idle = "bg-background border-input hover:bg-muted text-muted-foreground";
  return (
    <nav
      aria-label="Article pages"
      className="sb-pagination mt-12 flex flex-wrap items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onGo(page - 1)}
        disabled={page === 1}
        className={`${btn} ${idle} gap-1 disabled:opacity-40 disabled:pointer-events-none`}
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onGo(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${btn} ${
            n === page
              ? "sb-page-current bg-primary text-primary-foreground border-primary"
              : idle
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onGo(page + 1)}
        disabled={page === totalPages}
        className={`${btn} ${idle} gap-1 disabled:opacity-40 disabled:pointer-events-none`}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}

// Mobile article cards show the read time instead of the author [zoe, 2026-10-02].
// listPosts doesn't return the body, so each card reads its own post (same
// words/200 formula as the article page).
function MobileReadTime({ siteSlug, slug }: { siteSlug: string; slug: string }) {
  const post = useQuery(api.content.getPost, { siteSlug, slug });
  if (!post?.body) return null;
  return (
    <span className="inline-flex sm:hidden items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" />
      {readMinutes(post.body)} min read
    </span>
  );
}
