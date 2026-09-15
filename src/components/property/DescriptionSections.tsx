import { Check } from "lucide-react";
import { parseDescription } from "@/lib/describeProperty";

/**
 * Renders a property description as prose plus titled, two-column bullet
 * sections [scott, 2026-09-15].
 *
 * Deliberately styled to read as a different KIND of information from the
 * Amenities grid below it: amenities are a flat inventory of what exists,
 * whereas these sections are the sales copy's own structure (Villa Features,
 * Sleeping Arrangements, Nearby Attractions). Same visual family, lighter
 * weight — cards with a rule and a check mark, not icon tiles.
 */
export function DescriptionSections({ description }: { description: string }) {
  const blocks = parseDescription(description);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        if (block.kind === "prose") {
          return (
            <p key={i} className="text-muted-foreground leading-relaxed">
              {block.text}
            </p>
          );
        }

        return (
          <div key={i} className="rounded-xl border bg-muted/30 p-5">
            {block.heading && (
              <h3 className="text-base font-semibold font-[family-name:var(--font-display)] mb-3">
                {block.heading}
              </h3>
            )}
            {/* Two columns on desktop, one on mobile. Lists here run to
                thirteen-plus bullets, which is what made the old single
                column feel endless. */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <Check
                    className="w-4 h-4 mt-0.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {item.label && (
                      <span className="font-medium text-foreground">
                        {item.label}:{" "}
                      </span>
                    )}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
