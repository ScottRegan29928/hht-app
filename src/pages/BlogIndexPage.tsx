import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSiteFlags } from "../lib/siteContext";
import { useSeo } from "../lib/seo";
import { Calendar, User } from "lucide-react";

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
  });
  const tags = useQuery(api.content.listTags, { siteSlug });

  useSeo({
    title: "News & Island Guides",
    description: `Rental tips, island guides and community news from ${siteName}.`,
  });

  return (
    <>
      <main>
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <header className="mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
              News &amp; Island Guides
            </h1>
            <p className="text-muted-foreground text-lg">
              Sea Pines news, rental tips and things to do on Hilton Head Island.
            </p>
          </header>

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              <button
                onClick={() => setTag(null)}
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
                  onClick={() => setTag(t.tag)}
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
            <div className="grid gap-8 md:grid-cols-2">
              {posts.map((post) => (
                <Link
                  key={post._id}
                  to={`/blog/${post.slug}`}
                  className="group block rounded-xl border overflow-hidden hover:shadow-lg transition-shadow bg-background"
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
                        <span className="inline-flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {post.authorName}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
