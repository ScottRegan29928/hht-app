import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MapPin, ArrowLeft, Home } from "lucide-react";
import { IslandMap } from "@/components/map/IslandMap";
import { PropertyCard } from "@/components/property/PropertyCard";

export function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const community = useQuery(api.communities.getBySlug, {
    slug: slug ?? "",
  });
  const allCommunities = useQuery(api.communities.list);
  const properties = useQuery(
    api.properties.list,
    community
      ? { communityId: community._id, onlyActive: true }
      : "skip"
  );

  if (community === undefined) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-64 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (community === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold">Community not found</h1>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative h-64 sm:h-80 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/10">
        {community.heroImageUrl && (
          <img
            src={community.heroImageUrl}
            alt={community.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-white/70 text-sm hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Communities
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-display)]">
            {community.name}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-white/70 text-sm">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Sea Pines Resort
            </span>
            <span className="flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              {community.propertyCount ?? properties?.length ?? 0} Properties
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Description + Amenities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
          <div className="lg:col-span-2">
            {community.description && (
              <p className="text-muted-foreground leading-relaxed">
                {community.description}
              </p>
            )}
          </div>
          <div>
            {community.amenities && community.amenities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {community.amenities.map((a) => (
                    <span
                      key={a}
                      className="px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="mb-12 rounded-2xl overflow-hidden border border-border shadow-lg">
          <IslandMap
            communities={allCommunities ?? []}
            selectedCommunity={slug}
            height="350px"
            zoom={15}
          />
        </div>

        {/* Properties */}
        <div>
          <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] mb-6">
            Available Villas
          </h2>
          {properties === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-72 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No properties currently listed in this community.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map((property) => (
                <PropertyCard key={property._id} property={property} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
