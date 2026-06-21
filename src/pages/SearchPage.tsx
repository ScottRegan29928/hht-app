import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Search, LayoutGrid, Map as MapIcon, ListFilter } from "lucide-react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { SearchFilters } from "@/components/search/SearchFilters";
import { IslandMap } from "@/components/map/IslandMap";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "map";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [communityId, setCommunityId] = useState(
    searchParams.get("community") ?? ""
  );
  const [weekNumber, setWeekNumber] = useState(
    searchParams.get("week") ?? ""
  );
  const [bedrooms, setBedrooms] = useState(searchParams.get("beds") ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const communities = useQuery(api.communities.list);
  const properties = useQuery(api.properties.search, {
    communityId: communityId
      ? (communityId as Id<"communities">)
      : undefined,
    weekNumber: weekNumber ? parseInt(weekNumber) : undefined,
    minBedrooms: bedrooms ? parseInt(bedrooms) : undefined,
  });

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (communityId) params.set("community", communityId);
    if (weekNumber) params.set("week", weekNumber);
    if (bedrooms) params.set("beds", bedrooms);
    setSearchParams(params, { replace: true });
  }, [communityId, weekNumber, bedrooms, setSearchParams]);

  const clearFilters = () => {
    setCommunityId("");
    setWeekNumber("");
    setBedrooms("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">
            Find Your Villa
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {properties === undefined
              ? "Searching..."
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
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2.5 transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={cn(
                "p-2.5 transition-colors",
                viewMode === "map"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters — desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <SearchFilters
              communityId={communityId}
              setCommunityId={setCommunityId}
              weekNumber={weekNumber}
              setWeekNumber={setWeekNumber}
              bedrooms={bedrooms}
              setBedrooms={setBedrooms}
              onClear={clearFilters}
            />
          </div>
        </aside>

        {/* Mobile filters overlay */}
        {showMobileFilters && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50">
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-background p-6 shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="text-sm text-primary"
                >
                  Done
                </button>
              </div>
              <SearchFilters
                communityId={communityId}
                setCommunityId={setCommunityId}
                weekNumber={weekNumber}
                setWeekNumber={setWeekNumber}
                bedrooms={bedrooms}
                setBedrooms={setBedrooms}
                onClear={clearFilters}
              />
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-w-0">
          {viewMode === "map" ? (
            <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
              <IslandMap
                communities={communities ?? []}
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
                Try adjusting your filters or search for a different community
                or week number.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
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
