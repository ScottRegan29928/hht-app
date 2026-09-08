import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SlidersHorizontal, X, Check, ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNext52Weeks, formatWeekRange } from "@/lib/weekCalendar";
import { useSiteFlags } from "@/lib/siteContext";

export interface AvailableFacets {
  communities: Set<string>;
  weeks: Set<number>;
  bedrooms: Set<number>;
  hasRent: boolean;
  hasBuy: boolean;
  amenities: Set<string>;
}

/** Convert snake_case amenity key to display label */
function amenityLabel(key: string): string {
  const LABELS: Record<string, string> = {
    pool: "Swimming Pool",
    hot_tub: "Hot Tub",
    tennis: "Tennis Court",
    grill: "Grill Area",
    near_harbour_town: "Near Harbour Town",
    near_beach_club: "Near Beach Club",
    on_golf_course: "On Golf Course",
    beach_access: "Beach Access",
    bike_trails: "Bike Trails",
    fitness_center: "Fitness Center",
    golf: "Golf",
    lagoon_views: "Lagoon Views",
    marina: "Marina",
    nature_trails: "Nature Trails",
    playground: "Playground",
    shopping: "Shopping",
    water_views: "Water Views",
  };
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SearchFiltersProps {
  communitySlugs: string[];
  setCommunitySlugs: (v: string[]) => void;
  weekNumbers: string[];
  setWeekNumbers: (v: string[]) => void;
  bedrooms: string[];
  setBedrooms: (v: string[]) => void;
  listingTypes: string[];
  setListingTypes: (v: string[]) => void;
  amenities: string[];
  setAmenities: (v: string[]) => void;
  amenityMode: "and" | "or";
  setAmenityMode: (v: "and" | "or") => void;
  onClear: () => void;
  availableFacets?: AvailableFacets | null;
  // Rental date range
  checkIn: string;
  setCheckIn: (v: string) => void;
  checkOut: string;
  setCheckOut: (v: string) => void;
  // Buy year (kept for URL compat but no longer shown)
  selectedYear: string;
  setSelectedYear: (v: string) => void;
}

function toggleValue(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

interface DropdownMultiSelectProps {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}

function DropdownMultiSelect({ label, placeholder, options, selected, onChange }: DropdownMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  return (
    <div ref={ref}>
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {label}
        {selected.length > 0 && (
          <span className="ml-1 text-primary">({selected.length})</span>
        )}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left",
          selected.length > 0
            ? "border-primary/30 bg-primary/5 text-foreground font-medium"
            : "border-input bg-background text-muted-foreground hover:bg-muted"
        )}
      >
        <span className="truncate">{display}</span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 ml-2 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 border border-border rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No options available</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(toggleValue(selected, opt.value))}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                  selected.includes(opt.value)
                    ? "bg-primary/5 text-primary font-medium"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    selected.includes(opt.value)
                      ? "bg-primary border-primary text-white"
                      : "border-input"
                  )}
                >
                  {selected.includes(opt.value) && <Check className="w-3 h-3" />}
                </div>
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SearchFilters({
  communitySlugs,
  setCommunitySlugs,
  weekNumbers,
  setWeekNumbers,
  bedrooms,
  setBedrooms,
  listingTypes,
  setListingTypes,
  amenities,
  setAmenities,
  amenityMode,
  setAmenityMode,
  onClear,
  availableFacets,
  checkIn,
  setCheckIn,
  checkOut,
  setCheckOut,
  selectedYear,
  setSelectedYear,
}: SearchFiltersProps) {
  const { siteSlug } = useSiteFlags();
  const communities = useQuery(api.communities.list, { siteSlug });
  const allAmenities = useQuery(api.properties.allAmenities, { siteSlug });

  const mode = listingTypes.length === 1 ? listingTypes[0] : null; // "buy" | "rent" | null
  const isBuy = mode === "buy";
  const isRent = mode === "rent";
  const hasMode = isBuy || isRent;

  const hasFilters =
    communitySlugs.length > 0 ||
    weekNumbers.length > 0 ||
    bedrooms.length > 0 ||
    listingTypes.length > 0 ||
    amenities.length > 0 ||
    checkIn !== "" ||
    checkOut !== "";

  // Filter options to only show available ones
  const communityOptions = (communities ?? [])
    .filter((c) => !availableFacets || availableFacets.communities.has(c.slug))
    .map((c) => ({ value: c.slug, label: c.name }));

  // Rolling 52-week picker for Buy mode — no year picker, shows next 52 upcoming weeks
  const next52 = getNext52Weeks();
  const weekOptions = next52
    .map((w) => ({
      value: String(w.weekNumber),
      label: `Wk ${w.weekNumber}: ${formatWeekRange(w.weekNumber, w.year)}`,
    }))
    .filter((w) => !availableFacets || availableFacets.weeks.has(Number(w.value)));

  const showRent = !availableFacets || availableFacets.hasRent;
  const showBuy = !availableFacets || availableFacets.hasBuy;

  const bedroomOptions = ["1", "2", "3", "4"].filter(
    (b) => !availableFacets || availableFacets.bedrooms.has(Number(b))
  );

  const amenityOptions = (allAmenities ?? [])
    .map((key) => ({ value: key, label: amenityLabel(key) }))
    .filter((a) => !availableFacets || availableFacets.amenities.has(a.value));

  // Today for min date on date picker
  const today = new Date().toISOString().split("T")[0];

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

      {/* ── Listing Type — show ONLY when no mode is locked via URL ── */}
      {!hasMode && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            I Want To…
          </label>
          <div className="flex gap-2">
            {showRent && (
              <button
                onClick={() => {
                  setListingTypes(["rent"]);
                  setWeekNumbers([]);
                  setSelectedYear("");
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border bg-background border-input hover:bg-muted text-muted-foreground"
              >
                Rent
              </button>
            )}
            {showBuy && (
              <button
                onClick={() => {
                  setListingTypes(["buy"]);
                  setCheckIn("");
                  setCheckOut("");
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border bg-background border-input hover:bg-muted text-muted-foreground"
              >
                Buy
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Gated: No mode selected ── */}
      {!hasMode && (
        <div className="flex flex-col items-center gap-2 py-8 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <Lock className="w-6 h-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">
            Choose <strong>Rent</strong> or <strong>Buy</strong> to see filters
          </p>
        </div>
      )}

      {/* ── Buy-mode filters (no year picker, rolling 52 weeks) ── */}
      {isBuy && (
        <>
          {/* Week selector — rolling next 52 weeks with date ranges */}
          <DropdownMultiSelect
            label="Week"
            placeholder="Any Week"
            options={weekOptions}
            selected={weekNumbers}
            onChange={setWeekNumbers}
          />

          {/* Community */}
          <DropdownMultiSelect
            label="Community"
            placeholder="Communities"
            options={communityOptions}
            selected={communitySlugs}
            onChange={setCommunitySlugs}
          />

          {/* Bedrooms */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Bedrooms
            </label>
            <div className="flex gap-2">
              {bedroomOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => setBedrooms(toggleValue(bedrooms, b))}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-colors border",
                    bedrooms.includes(b)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-input hover:bg-muted text-muted-foreground"
                  )}
                >
                  {b}+
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          {amenityOptions.length > 0 && (
            <AmenityFilter
              amenityOptions={amenityOptions}
              amenities={amenities}
              setAmenities={setAmenities}
              amenityMode={amenityMode}
              setAmenityMode={setAmenityMode}
            />
          )}
        </>
      )}

      {/* ── Rent-mode filters ── */}
      {isRent && (
        <>
          {/* Check-in / Check-out Date Picker */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Check-in
            </label>
            <input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => {
                setCheckIn(e.target.value);
                // Auto-adjust checkout if before check-in
                if (checkOut && e.target.value && checkOut <= e.target.value) {
                  const next = new Date(e.target.value);
                  next.setDate(next.getDate() + 1);
                  setCheckOut(next.toISOString().split("T")[0]);
                }
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Check-out
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn || today}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Community */}
          <DropdownMultiSelect
            label="Community"
            placeholder="Communities"
            options={communityOptions}
            selected={communitySlugs}
            onChange={setCommunitySlugs}
          />

          {/* Bedrooms */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Bedrooms
            </label>
            <div className="flex gap-2">
              {bedroomOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => setBedrooms(toggleValue(bedrooms, b))}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-colors border",
                    bedrooms.includes(b)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-input hover:bg-muted text-muted-foreground"
                  )}
                >
                  {b}+
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          {amenityOptions.length > 0 && (
            <AmenityFilter
              amenityOptions={amenityOptions}
              amenities={amenities}
              setAmenities={setAmenities}
              amenityMode={amenityMode}
              setAmenityMode={setAmenityMode}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Amenity filter sub-component ──
function AmenityFilter({
  amenityOptions,
  amenities,
  setAmenities,
  amenityMode,
  setAmenityMode,
}: {
  amenityOptions: { value: string; label: string }[];
  amenities: string[];
  setAmenities: (v: string[]) => void;
  amenityMode: "and" | "or";
  setAmenityMode: (v: "and" | "or") => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Amenities
        </label>
        {amenities.length >= 2 && (
          <div className="flex items-center bg-muted rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setAmenityMode("and")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold transition-colors",
                amenityMode === "and"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              AND
            </button>
            <button
              onClick={() => setAmenityMode("or")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold transition-colors",
                amenityMode === "or"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              OR
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {amenityOptions.map((a) => (
          <button
            key={a.value}
            onClick={() => setAmenities(toggleValue(amenities, a.value))}
            className={cn(
              "py-2 px-2 rounded-lg text-xs font-medium transition-colors border text-center",
              amenities.includes(a.value)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-input hover:bg-muted text-muted-foreground"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
