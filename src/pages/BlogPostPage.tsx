import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSiteFlags } from "../lib/siteContext";
import { useSeo } from "../lib/seo";
import { Markdown } from "../lib/markdown";
import { ArrowLeft, Calendar, User } from "lucide-react";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
              to="/blog"
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

  return (
    <>
      <main>
        <article className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            All articles
          </Link>

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

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(post.publishedAt ?? post.createdAt)}
            </span>
            {post.authorName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.authorName}
              </span>
            )}
          </div>

          {post.coverImageUrl && (
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full rounded-xl mb-8 aspect-[16/9] object-cover bg-muted"
            />
          )}

          <Markdown source={post.body} />
        </article>
      </main>
    </>
  );
}
