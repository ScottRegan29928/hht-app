import { formatPrice, weekNumberToDateRange } from "@/lib/utils";

interface Week {
  _id: string;
  weekNumber: number;
  price?: number | null;
  priceLabel?: string | null;
  notes?: string | null;
  status: string;
}

interface WeeksTableProps {
  weeks: Week[];
  onInquire?: (week: Week) => void;
}

export function WeeksTable({ weeks, onInquire }: WeeksTableProps) {
  if (weeks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No weeks currently available for this property.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Week
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dates (approx.)
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Price
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </th>
            <th className="text-right py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr
              key={week._id}
              className="border-b border-border/50 hover:bg-muted/50 transition-colors"
            >
              <td className="py-3.5 px-4">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                  {week.weekNumber}
                </span>
              </td>
              <td className="py-3.5 px-4 text-sm text-muted-foreground">
                {weekNumberToDateRange(week.weekNumber)}
              </td>
              <td className="py-3.5 px-4">
                {week.price ? (
                  <span className="text-sm font-semibold text-foreground">
                    {formatPrice(week.price)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    {week.priceLabel || "Contact for pricing"}
                  </span>
                )}
              </td>
              <td className="py-3.5 px-4 text-sm text-muted-foreground max-w-[200px] truncate">
                {week.notes || "—"}
              </td>
              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => onInquire?.(week)}
                  className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Make an Offer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
