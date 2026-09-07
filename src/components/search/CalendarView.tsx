import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import { Calendar, Home, DollarSign, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

interface CalendarViewProps {
  searchArgs: Record<string, unknown>;
}

/** Get the date range for a given ISO week number in a year */
function weekToDateRange(weekNum: number, year: number): { start: Date; end: Date } {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1 … Sun=7
  const isoWeek1Monday = new Date(jan4);
  isoWeek1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  const start = new Date(isoWeek1Monday);
  start.setDate(isoWeek1Monday.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Month labels for the 52-week strip */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function CalendarView({ searchArgs }: CalendarViewProps) {
  const calendarWeeks = useQuery(api.properties.searchWeeksForCalendar, searchArgs);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Group weeks by week number
  const weeksByNumber = useMemo(() => {
    if (!calendarWeeks) return new Map<number, typeof calendarWeeks>();
    const map = new Map<number, typeof calendarWeeks>();
    for (const w of calendarWeeks) {
      const wYear = w.year ?? currentYear;
      if (!w.isAnnual && wYear !== selectedYear) continue;
      const existing = map.get(w.weekNumber) ?? [];
      existing.push(w);
      map.set(w.weekNumber, existing);
    }
    return map;
  }, [calendarWeeks, selectedYear, currentYear]);

  // Determine which month each week falls in (for month headers)
  const weekMonths = useMemo(() => {
    const result: { weekNum: number; month: number; isFirstOfMonth: boolean }[] = [];
    let lastMonth = -1;
    for (let w = 1; w <= 52; w++) {
      const { start } = weekToDateRange(w, selectedYear);
      const month = start.getMonth();
      result.push({
        weekNum: w,
        month,
        isFirstOfMonth: month !== lastMonth,
      });
      lastMonth = month;
    }
    return result;
  }, [selectedYear]);

  if (calendarWeeks === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const totalListings = calendarWeeks.length;
  const weeksWithListings = weeksByNumber.size;

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            {[currentYear, currentYear + 1].map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  selectedYear === y
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {totalListings} {totalListings === 1 ? "listing" : "listings"} across{" "}
          {weeksWithListings} {weeksWithListings === 1 ? "week" : "weeks"}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
          Rent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
          Sale
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-teal-500/20 border border-teal-500/30" />
          Rent & Sale
        </span>
      </div>

      {/* Calendar grid */}
      <div className="space-y-0">
        {weekMonths.map(({ weekNum, month, isFirstOfMonth }) => {
          const listings = weeksByNumber.get(weekNum) ?? [];
          const { start, end } = weekToDateRange(weekNum, selectedYear);
          const hasListings = listings.length > 0;
          const isPast = end < new Date();

          return (
            <div key={weekNum}>
              {/* Month header */}
              {isFirstOfMonth && (
                <div className="flex items-center gap-3 pt-4 pb-2">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    {MONTHS[month]}
                  </h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {/* Week row */}
              <div
                className={cn(
                  "group flex items-stretch border-b border-border/50 transition-colors",
                  hasListings
                    ? "hover:bg-primary/[0.03]"
                    : isPast
                      ? "opacity-40"
                      : "opacity-60"
                )}
              >
                {/* Week number + dates */}
                <div className="w-40 shrink-0 flex items-center gap-3 py-2.5 pr-4">
                  <span
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      hasListings
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {weekNum}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(start)} – {formatDate(end)}
                  </div>
                </div>

                {/* Listings */}
                <div className="flex-1 py-2 overflow-x-auto">
                  {hasListings ? (
                    <div className="flex flex-wrap gap-2">
                      {listings.map((l, idx) => (
                        <Link
                          key={`${l.propertyId}-${idx}`}
                          to={`/property/${l.propertySlug}`}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm",
                            l.listingType === "rent"
                              ? "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
                              : l.listingType === "sale"
                                ? "bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                                : "bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300"
                          )}
                        >
                          {l.photoUrl && (
                            <img
                              src={l.photoUrl}
                              alt=""
                              className="w-6 h-6 rounded object-cover"
                            />
                          )}
                          <span className="truncate max-w-[140px]">{l.propertyAddress}</span>
                          <span className="text-[10px] opacity-70">{l.communityName}</span>
                          {l.listingType === "sale" || l.listingType === "both" ? (
                            l.price ? (
                              <span className="font-bold">${l.price.toLocaleString()}</span>
                            ) : null
                          ) : null}
                          {l.listingType === "rent" || l.listingType === "both" ? (
                            l.rentPrice ? (
                              <span className="font-bold">${l.rentPrice.toLocaleString()}/wk</span>
                            ) : null
                          ) : null}
                          {!l.price && !l.rentPrice && l.priceLabel ? (
                            <span className="font-bold">{l.priceLabel}</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center">
                      <span className="text-xs text-muted-foreground/50">—</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalListings === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No weeks available</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            No available weeks match your current filters. Try adjusting your search.
          </p>
        </div>
      )}
    </div>
  );
}
