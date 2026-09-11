import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { MapPin, Search, ArrowRight, Waves, Home, Calendar, Key, DollarSign } from "lucide-react";
import { IslandMap } from "@/components/map/IslandMap";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useSiteFlags, useSiteBrand } from "@/lib/siteContext";
import { HeritageHero } from "@/components/home/HeritageHero";
import { HeritageFilterTiles } from "@/components/home/HeritageFilterTiles";
import { useSeo } from "../lib/seo";
import { resolveHomeContent } from "@/lib/homeContent";

export function HomePage() {
  const { siteSlug } = useSiteFlags();

  // Title/description/OG for "/" come from the Home record in Pages, so the
  // backend edit is what the browser tab and share previews show.
  const homeMeta = useQuery(api.content.getHomeMeta, { siteSlug });
  useSeo({
    title: homeMeta?.seo?.metaTitle ?? homeMeta?.title,
    description: homeMeta?.seo?.metaDescription,
    ogImageUrl: homeMeta?.seo?.ogImageUrl,
    canonicalUrl: homeMeta?.seo?.canonicalUrl,
    noindex: homeMeta?.seo?.noindex,
  });
  const brand = useSiteBrand();
  // Copy and images come from the Home record in Pages, falling back to the
  // designed defaults for anything unset [scott, 2026-09-11].
  const content = resolveHomeContent(siteSlug, homeMeta?.homeContent);
  // mhht has no hero banner — the property map is the hero [scott, 2026-09-10].
  const isMapHero = siteSlug === "mhht";
  const communities = useQuery(api.communities.list, { siteSlug });
  const featuredProperties = useQuery(api.properties.list, {
    onlyFeatured: true,
    siteSlug,
  });

  return (
    <div>
      {/* ── Hero ──
          Heritage gets the measured recreation of heritagevacations.com.
          The other three sites keep the shared hero until their own
          front ends are designed (Scott's ordering: hv, hht, then Sea Pines). */}
      {siteSlug === "heritage" ? (
        <HeritageHero content={content} />
      ) : siteSlug === "mhht" ? null : (
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
            {/* 50/50 copy + image */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">
              {/* Left — copy */}
              <div className="lg:w-1/2 lg:shrink-0">
                <div className="flex items-center gap-2 text-primary/70 mb-4">
                  <Waves className="w-5 h-5" />
                  <span className="text-sm font-medium tracking-wide uppercase">
                    {content.hero.eyebrow || brand.eyebrow}
                  </span>
                </div>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] font-[family-name:var(--font-display)]">
                  {content.hero.headlineLines.length > 0 ? (
                    content.hero.headlineLines.map((line, i) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        {i === content.hero.headlineLines.length - 1 &&
                        content.hero.headlineLines.length > 1 ? (
                          <span className="text-primary">{line}</span>
                        ) : (
                          line
                        )}
                      </span>
                    ))
                  ) : (
                    <>
                      {brand.headlineTop}
                      <br />
                      <span className="text-primary">{brand.headlineAccent}</span>
                    </>
                  )}
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
                  {content.hero.intro || brand.intro}
                </p>
              </div>

              {/* Right — lighthouse hero image */}
              <div className="hidden lg:block lg:w-1/2 relative mt-8 lg:mt-0">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src={content.hero.images[0] ?? "/lighthouse.jpg"}
                    alt={
                      content.hero.images[0]
                        ? ""
                        : "Harbour Town Lighthouse at sunset, Hilton Head Island"
                    }
                    className="w-full h-[420px] object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              </div>
            </div>

            {/* ── Two entry points: Buy / Rent ── */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to={content.hero.primaryHref}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-md"
              >
                <Calendar className="w-4 h-4" />
                {content.hero.primaryLabel}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={content.hero.secondaryHref}
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary/5 transition-colors"
              >
                <Key className="w-4 h-4" />
                {content.hero.secondaryLabel}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </section>
      )}

      {/* ── Amenity shortcut tiles (Heritage only) ── */}
      {siteSlug === "heritage" && <HeritageFilterTiles content={content} />}

      {/* ── Interactive Map ──
          On mhht this replaces the hero banner entirely, so it carries the
          headline and intro copy [scott, 2026-09-10]. */}
      <section
        className={
          isMapHero
            ? "pt-10 pb-16 sm:pt-14 sm:pb-20 bg-card"
            : "py-16 sm:py-20 bg-card"
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            {isMapHero ? (
              <h1 className="text-4xl sm:text-5xl font-bold font-[family-name:var(--font-display)]">
                {content.map.heading}
              </h1>
            ) : (
              <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
                {content.map.heading}
              </h2>
            )}
            <p
              className={
                isMapHero
                  ? "mt-4 text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed"
                  : "mt-3 text-muted-foreground max-w-2xl mx-auto lg:whitespace-nowrap"
              }
            >
              {content.map.intro}
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
            <IslandMap communities={communities ?? []} />
          </div>
        </div>
      </section>

      {/* ── Communities Grid ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
                {content.communities.heading}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {content.communities.subheading}
              </p>
            </div>
            <Link
              to="/search"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all properties <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {communities === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {communities.map((community) => (
                <Link
                  key={community._id}
                  to={`/community/${community.slug}`}
                  className="group relative h-64 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-xl"
                >
                  {community.heroImageUrl && (
                    <img
                      src={community.heroImageUrl}
                      alt={community.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-lg font-semibold text-white font-[family-name:var(--font-display)]">
                      {community.name}
                    </h3>
                    {community.shortDescription && (
                      <p className="mt-1 text-sm text-white/70 line-clamp-2">
                        {community.shortDescription}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 text-white/60 text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Sea Pines</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Featured Properties ── */}
      {featuredProperties && featuredProperties.length > 0 && (
        <section className="py-16 sm:py-20 bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
                {content.featured.heading}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {content.featured.subheading}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.slice(0, 6).map((property) => (
                <PropertyCard key={property._id} property={property} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Section ──
          Off by default on Heritage [scott, 2026-09-08]; now a backend toggle. */}
      {content.closing.enabled && (
        <section className="py-16 sm:py-20 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
              {content.closing.heading}
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-2xl mx-auto">
              {content.closing.body}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={content.closing.primaryHref}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-white/90 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                {content.closing.primaryLabel}
              </Link>
              <Link
                to={content.closing.secondaryHref}
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary-foreground/30 rounded-lg font-semibold hover:bg-primary-foreground/10 transition-colors"
              >
                <Key className="w-4 h-4" />
                {content.closing.secondaryLabel}
              </Link>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
