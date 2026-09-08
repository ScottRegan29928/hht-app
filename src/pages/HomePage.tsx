import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { MapPin, Search, ArrowRight, Waves, Home, Calendar, Key, DollarSign } from "lucide-react";
import { IslandMap } from "@/components/map/IslandMap";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useSiteFlags, useSiteBrand } from "@/lib/siteContext";
import { HeritageHero } from "@/components/home/HeritageHero";

export function HomePage() {
  const { siteSlug } = useSiteFlags();
  const brand = useSiteBrand();
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
        <HeritageHero />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
            {/* 50/50 copy + image */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">
              {/* Left — copy */}
              <div className="lg:w-1/2 lg:shrink-0">
                <div className="flex items-center gap-2 text-primary/70 mb-4">
                  <Waves className="w-5 h-5" />
                  <span className="text-sm font-medium tracking-wide uppercase">
                    {brand.eyebrow}
                  </span>
                </div>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] font-[family-name:var(--font-display)]">
                  {brand.headlineTop}
                  <br />
                  <span className="text-primary">{brand.headlineAccent}</span>
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
                  {brand.intro}
                </p>
              </div>

              {/* Right — lighthouse hero image */}
              <div className="hidden lg:block lg:w-1/2 relative mt-8 lg:mt-0">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src="/lighthouse.jpg"
                    alt="Harbour Town Lighthouse at sunset, Hilton Head Island"
                    className="w-full h-[420px] object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              </div>
            </div>

            {/* ── Two entry points: Buy / Rent ── */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/search?type=buy"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-md"
              >
                <Key className="w-4 h-4" />
                Buy a Timeshare Week
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/search?type=rent"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary/5 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Rent a Villa
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </section>
      )}

      {/* ── Interactive Map ── */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
              Explore Sea Pines
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto lg:whitespace-nowrap">
              Click a community on the map to browse available villas and
              timeshare weeks.
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
                Communities
              </h2>
              <p className="mt-2 text-muted-foreground">
                Eight premier neighborhoods in Sea Pines
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
                Featured Villas
              </h2>
              <p className="mt-2 text-muted-foreground">
                Handpicked properties available now
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

      {/* ── CTA Section ── */}
      <section className="py-16 sm:py-20 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
            Ready to Own Your Piece of Paradise?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Whether you're looking to purchase a timeshare week or rent a
            beautiful villa, we're here to help you find the perfect fit.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/search?type=buy"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-white/90 transition-colors"
            >
              <Key className="w-4 h-4" />
              Buy a Week
            </Link>
            <Link
              to="/search?type=rent"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary-foreground/30 rounded-lg font-semibold hover:bg-primary-foreground/10 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Rent a Villa
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
