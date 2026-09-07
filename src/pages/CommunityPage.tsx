import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MapPin, ArrowLeft, Home } from "lucide-react";
import { IslandMap } from "@/components/map/IslandMap";
import { PropertyCard } from "@/components/property/PropertyCard";
import { SearchFilters } from "@/components/search/SearchFilters";
import { computeFacets } from "@/lib/facets";

export function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const community = useQuery(api.communities.getBySlug, {
    slug: slug ?? "",
  });
  const allCommunities = useQuery(api.communities.list);
  const facetData = useQuery(api.properties.listForFacets);

  // Filter state — community pre-selected to current page
  const [communitySlugs, setCommunitySlugs] = useState<string[]>(slug ? [slug] : []);
  const [weekNumbers, setWeekNumbers] = useState<string[]>([]);
  const [bedrooms, setBedrooms] = useState<string[]>([]);
  const [listingTypes, setListingTypes] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityMode, setAmenityMode] = useState<"and" | "or">("or");

  // Sync slug when route changes
  useEffect(() => {
    if (slug) setCommunitySlugs([slug]);
  }, [slug]);

  // Navigate to search when community filter changes away from current
  useEffect(() => {
    const hasOtherCommunity = communitySlugs.length > 0 && !(communitySlugs.length === 1 && communitySlugs[0] === slug);
    if (hasOtherCommunity || communitySlugs.length === 0) {
      const params = new URLSearchParams();
      if (communitySlugs.length) params.set("community", communitySlugs.join(","));
      if (weekNumbers.length) params.set("week", weekNumbers.join(","));
      if (bedrooms.length) params.set("beds", bedrooms.join(","));
      if (listingTypes.length) params.set("type", listingTypes.join(","));
      if (amenities.length) params.set("amenities", amenities.join(","));
      navigate(`/search?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communitySlugs]);

  // Build search args with current filters
  const searchArgs: Record<string, unknown> = {};
  if (communitySlugs.length > 0) searchArgs.communitySlugs = communitySlugs;
  else if (slug) searchArgs.communitySlugs = [slug];
  if (weekNumbers.length > 0) searchArgs.weekNumbers = weekNumbers.map(Number);
  if (bedrooms.length > 0) searchArgs.bedroomValues = bedrooms.map(Number);
  if (listingTypes.length > 0 && listingTypes.length < 2) {
    searchArgs.listingTypes = listingTypes;
  }
  if (amenities.length > 0) {
    searchArgs.amenities = amenities;
    searchArgs.amenityMode = amenityMode;
  }

  const properties = useQuery(api.properties.search, searchArgs);

  // Compute dynamic facets
  const availableFacets = useMemo(() => {
    if (!facetData) return null;
    return computeFacets(facetData, {
      communitySlugs,
      weekNumbers: weekNumbers.map(Number),
      bedroomValues: bedrooms.map(Number),
      listingTypes,
      amenities,
    });
  }, [facetData, communitySlugs, weekNumbers, bedrooms, listingTypes, amenities]);

  const clearFilters = () => {
    setCommunitySlugs(slug ? [slug] : []);
    setWeekNumbers([]);
    setBedrooms([]);
    setListingTypes([]);
    setAmenities([]);
    setAmenityMode("or");
  };

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
              Sea Pines
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

        {/* Sidebar + Properties */}
        <div className="flex gap-8">
          {/* Sidebar filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 scrollbar-thin">
              <SearchFilters
                communitySlugs={communitySlugs}
                setCommunitySlugs={setCommunitySlugs}
                weekNumbers={weekNumbers}
                setWeekNumbers={setWeekNumbers}
                bedrooms={bedrooms}
                setBedrooms={setBedrooms}
                listingTypes={listingTypes}
                setListingTypes={setListingTypes}
                amenities={amenities}
                setAmenities={setAmenities}
                amenityMode={amenityMode}
                setAmenityMode={setAmenityMode}
                onClear={clearFilters}
                availableFacets={availableFacets}
              />
            </div>
          </aside>

          {/* Properties */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] mb-6">
              Available Villas
            </h2>
            {properties === undefined ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-72 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No properties match your filters.</p>
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-primary hover:text-primary/80"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {properties.map((property) => (
                  <PropertyCard key={property._id} property={property} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
