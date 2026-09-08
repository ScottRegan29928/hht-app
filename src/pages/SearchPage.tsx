import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSiteFlags } from "../lib/siteContext";
import { Search, LayoutGrid, Map as MapIcon, Calendar, ListFilter } from "lucide-react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { SearchFilters } from "@/components/search/SearchFilters";
import { IslandMap } from "@/components/map/IslandMap";
import { CalendarView } from "@/components/search/CalendarView";
import { computeFacets } from "@/lib/facets";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "map" | "calendar";

function parseMulti(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").filter(Boolean);
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [communitySlugs, setCommunitySlugs] = useState<string[]>(
    parseMulti(searchParams.get("community"))
  );
  const [weekNumbers, setWeekNumbers] = useState<string[]>(
    parseMulti(searchParams.get("week"))
  );
  const [bedrooms, setBedrooms] = useState<string[]>(
    parseMulti(searchParams.get("beds"))
  );
  const [listingTypes, setListingTypes] = useState<string[]>(
    parseMulti(searchParams.get("type"))
  );
  const [amenities, setAmenities] = useState<string[]>(
    parseMulti(searchParams.get("amenities"))
  );
  const [amenityMode, setAmenityMode] = useState<"and" | "or">(
    (searchParams.get("amenityMode") as "and" | "or") || "or"
  );
  // Rent-mode date range
  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") ?? "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") ?? "");
  // Buy-mode year
  const [selectedYear, setSelectedYear] = useState(searchParams.get("year") ?? "");

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const { siteSlug } = useSiteFlags();
  const communities = useQuery(api.communities.list, { siteSlug });
  const facetData = useQuery(api.properties.listForFacets, { siteSlug });

  const mode = listingTypes.length === 1 ? listingTypes[0] : null;
  const isBuy = mode === "buy";
  const isRent = mode === "rent";

  // Build query args for Convex
  const searchArgs: Record<string, unknown> = {};
  if (communitySlugs.length > 0) searchArgs.communitySlugs = communitySlugs;
  if (isBuy && weekNumbers.length > 0) searchArgs.weekNumbers = weekNumbers.map(Number);
  if (bedrooms.length > 0) searchArgs.bedroomValues = bedrooms.map(Number);
  if (listingTypes.length > 0 && listingTypes.length < 2) {
    searchArgs.listingTypes = listingTypes;
  }
  if (amenities.length > 0) {
    searchArgs.amenities = amenities;
    searchArgs.amenityMode = amenityMode;
  }
  if (isRent && checkIn) searchArgs.checkIn = checkIn;
  if (isRent && checkOut) searchArgs.checkOut = checkOut;

  const hasActiveFilters =
    communitySlugs.length > 0 ||
    weekNumbers.length > 0 ||
    bedrooms.length > 0 ||
    listingTypes.length > 0 ||
    amenities.length > 0 ||
    checkIn !== "" ||
    checkOut !== "";

  // Multi-site: scope results to the current hostname's site (server-enforced).
  const scopedArgs = { ...searchArgs, siteSlug };

  const properties = useQuery(api.properties.search, scopedArgs);

  // Track last-known filtered communities for the map to avoid flicker
  const lastMapCommunitiesRef = useRef<typeof communities>(null);
  const mapCommunities = useMemo(() => {
    const all = communities ?? [];
    if (!hasActiveFilters) {
      lastMapCommunitiesRef.current = all;
      return all;
    }
    if (properties === undefined) {
      return lastMapCommunitiesRef.current ?? all;
    }
    const filtered = all.filter((c) =>
      properties.some((p: any) => p.communitySlug === c.slug)
    );
    lastMapCommunitiesRef.current = filtered;
    return filtered;
  }, [communities, properties, hasActiveFilters]);

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

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (communitySlugs.length) params.set("community", communitySlugs.join(","));
    if (weekNumbers.length) params.set("week", weekNumbers.join(","));
    if (bedrooms.length) params.set("beds", bedrooms.join(","));
    if (listingTypes.length) params.set("type", listingTypes.join(","));
    if (amenities.length) params.set("amenities", amenities.join(","));
    if (amenityMode !== "or") params.set("amenityMode", amenityMode);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (selectedYear) params.set("year", selectedYear);
    setSearchParams(params, { replace: true });
  }, [communitySlugs, weekNumbers, bedrooms, listingTypes, amenities, amenityMode, checkIn, checkOut, selectedYear, setSearchParams]);

  const clearFilters = () => {
    setCommunitySlugs([]);
    setWeekNumbers([]);
    setBedrooms([]);
    setListingTypes([]);
    setAmenities([]);
    setAmenityMode("or");
    setCheckIn("");
    setCheckOut("");
    setSelectedYear("");
  };

  // Heading based on mode
  const heading = isBuy ? "Buy a Week" : isRent ? "Find a Rental" : "Find Your Villa";
  const subtitle = isBuy
    ? "Browse available weeks with dates and pricing"
    : isRent
      ? "Pick your dates and find the perfect vacation rental"
      : "Choose Rent or Buy to get started";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">
            {heading}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {properties === undefined
              ? subtitle
              : `${properties.length} ${properties.length === 1 ? "property" : "properties"} found`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            Filters
          </button>
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {([
              { mode: "grid" as ViewMode, icon: LayoutGrid, label: "Grid" },
              { mode: "map" as ViewMode, icon: MapIcon, label: "Map" },
              { mode: "calendar" as ViewMode, icon: Calendar, label: "Calendar" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "p-2.5 transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters — desktop */}
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
              checkIn={checkIn}
              setCheckIn={setCheckIn}
              checkOut={checkOut}
              setCheckOut={setCheckOut}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
            />
          </div>
        </aside>

        {/* Mobile filters overlay */}
        {showMobileFilters && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50">
            <div
              className="absolute inset-0"
              onClick={() => setShowMobileFilters(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                <h2 className="font-semibold text-lg">Filters</h2>
                <button
                  onClick={() => { clearFilters(); setShowMobileFilters(false); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
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
                  checkIn={checkIn}
                  setCheckIn={setCheckIn}
                  checkOut={checkOut}
                  setCheckOut={setCheckOut}
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                />
              </div>
              <div className="p-4 border-t border-border bg-background shrink-0">
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Apply Filters
                  {hasActiveFilters && (
                    <span className="ml-1.5 opacity-80">
                      ({properties?.length ?? "…"} results)
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-w-0">
          {viewMode === "calendar" ? (
            <CalendarView searchArgs={searchArgs} />
          ) : viewMode === "map" ? (
            <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
              <IslandMap
                communities={mapCommunities}
                height="600px"
              />
            </div>
          ) : properties === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 bg-muted rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">
                No properties found
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                {!hasActiveFilters
                  ? "Choose Rent or Buy to start browsing properties."
                  : "Try adjusting your filters or search for a different community or date range."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {properties.map((property) => (
                <PropertyCard
                  key={property._id}
                  property={property}
                  mode={mode ?? undefined}
                  checkIn={isRent ? checkIn : undefined}
                  checkOut={isRent ? checkOut : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
