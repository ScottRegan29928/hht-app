import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Weeks run Friday to Friday" — stated wherever someone is looking at weeks
 * for sale [scott, 2026-09-15].
 *
 * Swallowtail and Spicebush are weekly timeshares: ownership is a fixed week
 * number, and that week's actual dates shift a day or two each year because
 * the calendar always starts on a Friday. Buyers who have only seen nightly
 * vacation rentals assume they are picking arbitrary dates, so the sales side
 * says this explicitly instead of leaving it to be inferred from the week
 * table.
 *
 * `variant` controls weight, not wording — the message stays identical
 * everywhere it appears.
 */
export function FridayNote({
  variant = "inline",
  className,
}: {
  variant?: "inline" | "card";
  className?: string;
}) {
  const text =
    "Swallowtail and Spicebush are weekly timeshares. Ownership is by the week, and every week runs Friday to Friday, so a week's exact dates shift slightly each year.";

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground",
          className,
        )}
      >
        <CalendarDays className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <p>{text}</p>
      </div>
    );
  }

  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted-foreground", className)}>
      <CalendarDays className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
