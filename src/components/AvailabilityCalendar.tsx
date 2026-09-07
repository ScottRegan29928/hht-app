import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

interface AvailabilityCalendarProps {
  propertyId: Id<"properties">;
  /** Optional callback when a date is clicked */
  onDateClick?: (date: string, isBooked: boolean) => void;
  /** Optional: highlight a check-in → check-out range */
  selectedRange?: { checkIn: string; checkOut: string };
}

export function AvailabilityCalendar({
  propertyId,
  onDateClick,
  selectedRange,
}: AvailabilityCalendarProps) {
  const bookings = useQuery(api.calendar.getPropertyBookings, { propertyId });

  // Show loading state while query is in flight
  if (bookings === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading availability…
      </div>
    );
  }

  // Build 6-month calendar starting from current month
  const today = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  // Convert bookings to a Set of booked date strings for fast lookup
  const bookedDates = new Set<string>();
  for (const b of bookings) {
    const start = new Date(b.startDate + "T00:00:00");
    const end = new Date(b.endDate + "T00:00:00");
    const cur = new Date(start);
    while (cur < end) {
      bookedDates.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Build selected range set for highlighting
  const selectedDates = new Set<string>();
  if (selectedRange?.checkIn && selectedRange?.checkOut) {
    const start = new Date(selectedRange.checkIn + "T00:00:00");
    const end = new Date(selectedRange.checkOut + "T00:00:00");
    const cur = new Date(start);
    while (cur < end) {
      selectedDates.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div>
      <h3 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-3">
        Availability
      </h3>
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
          Booked
        </span>
        {selectedDates.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-200 border border-blue-400" />
            Selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map(({ year, month }) => {
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const cells: Array<{ day: number; dateStr: string } | null> = [];

          // Empty cells before first day
          for (let i = 0; i < firstDay; i++) cells.push(null);
          // Day cells
          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            cells.push({ day: d, dateStr });
          }

          return (
            <div key={`${year}-${month}`} className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs font-semibold text-center mb-2">
                {monthNames[month]} {year}
              </p>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {dayNames.map((dn) => (
                  <div key={dn} className="text-[10px] text-muted-foreground font-medium py-0.5">
                    {dn}
                  </div>
                ))}
                {cells.map((cell, i) => {
                  if (cell === null) return <div key={`empty-${i}`} />;

                  const isPast = cell.dateStr < todayStr;
                  const isBooked = bookedDates.has(cell.dateStr);
                  const isSelected = selectedDates.has(cell.dateStr);
                  const isConflict = isSelected && isBooked;
                  const clickable = onDateClick && !isPast;

                  let className = "text-[11px] py-1 rounded-sm ";
                  if (isPast) {
                    className += "text-muted-foreground/40";
                  } else if (isConflict) {
                    // Selected dates that overlap with booked → red with ring
                    className += "bg-red-200 text-red-800 ring-2 ring-red-400 font-bold";
                  } else if (isSelected) {
                    className += "bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-medium";
                  } else if (isBooked) {
                    className += "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 font-medium";
                  } else {
                    className += "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400";
                  }

                  if (clickable) {
                    className += " cursor-pointer hover:ring-1 hover:ring-primary/40";
                  }

                  return (
                    <div
                      key={cell.dateStr}
                      className={className}
                      onClick={clickable ? () => onDateClick(cell.dateStr, isBooked) : undefined}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook to get booked date ranges for a property.
 * Returns a Set of ISO date strings that are booked.
 */
export function useBookedDates(propertyId: Id<"properties"> | undefined) {
  const bookings = useQuery(
    api.calendar.getPropertyBookings,
    propertyId ? { propertyId } : "skip"
  );

  if (!bookings) return { bookedDates: new Set<string>(), loading: bookings === undefined };

  const bookedDates = new Set<string>();
  for (const b of bookings) {
    const start = new Date(b.startDate + "T00:00:00");
    const end = new Date(b.endDate + "T00:00:00");
    const cur = new Date(start);
    while (cur < end) {
      bookedDates.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }

  return { bookedDates, loading: false };
}
