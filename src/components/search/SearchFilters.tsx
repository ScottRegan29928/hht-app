import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchFiltersProps {
  communityId: string;
  setCommunityId: (v: string) => void;
  weekNumber: string;
  setWeekNumber: (v: string) => void;
  bedrooms: string;
  setBedrooms: (v: string) => void;
  onClear: () => void;
}

export function SearchFilters({
  communityId,
  setCommunityId,
  weekNumber,
  setWeekNumber,
  bedrooms,
  setBedrooms,
  onClear,
}: SearchFiltersProps) {
  const communities = useQuery(api.communities.list);
  const hasFilters = communityId || weekNumber || bedrooms;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </div>
        {hasFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Community */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Community
        </label>
        <div className="space-y-1">
          <button
            onClick={() => setCommunityId("")}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
              !communityId
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            All Communities
          </button>
          {communities?.map((c) => (
            <button
              key={c._id}
              onClick={() => setCommunityId(c._id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                communityId === c._id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Week Number */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Week Number
        </label>
        <select
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any Week</option>
          {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      {/* Bedrooms */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Bedrooms
        </label>
        <div className="flex gap-2">
          {["", "1", "2", "3", "4"].map((b) => (
            <button
              key={b}
              onClick={() => setBedrooms(b)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors border",
                bedrooms === b
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:bg-muted text-muted-foreground"
              )}
            >
              {b || "Any"}
              {b && "+"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
