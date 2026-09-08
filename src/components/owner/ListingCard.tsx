import { Mail, Phone, MapPin, Clock } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";

export type Listing = Doc<"marketplaceListings">;

const COMMUNITY_LABEL: Record<string, string> = {
  spicebush: "Spicebush",
  "swallowtail-at-sea-pines": "Swallowtail",
};

export function communityLabel(slug?: string) {
  if (!slug) return "Sea Pines";
  return COMMUNITY_LABEL[slug] ?? slug;
}

export function formatPostedAt(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Owners set their own prices, and legacy rows often have none. */
export function formatPrice(price?: number) {
  if (!price || price <= 0) return "Contact for price";
  return `$${price.toLocaleString("en-US")}`;
}

export function ListingCard({
  listing,
  footer,
}: {
  listing: Listing;
  footer?: React.ReactNode;
}) {
  const { kind } = listing;
  const unitLine = [
    listing.unitNumber ? `Unit ${listing.unitNumber}` : null,
    listing.weekLabel ? `Week ${listing.weekLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-background border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <MapPin className="w-3.5 h-3.5" />
            {communityLabel(listing.communitySlug)}
          </div>
          <h3 className="font-semibold text-base">
            {unitLine || "Week details on request"}
          </h3>
        </div>

        {kind === "for_sale" && (
          <div className="text-right shrink-0">
            <div className="font-semibold text-primary">
              {formatPrice(listing.askingPrice)}
            </div>
            <div className="text-[11px] text-muted-foreground">asking</div>
          </div>
        )}

        {kind === "trade" && listing.desiredWeekLabel && (
          <div className="text-right shrink-0">
            <div className="font-semibold text-primary">
              Wants week {listing.desiredWeekLabel}
            </div>
            <div className="text-[11px] text-muted-foreground">
              one-time trade
            </div>
          </div>
        )}
      </div>

      {listing.notes && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {listing.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-1 border-t">
        {listing.contactName && (
          <span className="font-medium pt-2">{listing.contactName}</span>
        )}
        {listing.contactPhone && (
          <a
            href={`tel:${listing.contactPhone.replace(/[^\d+]/g, "")}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary pt-2"
          >
            <Phone className="w-3.5 h-3.5" />
            {listing.contactPhone}
          </a>
        )}
        {listing.contactEmail && (
          <a
            href={`mailto:${listing.contactEmail}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary pt-2 break-all"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            {listing.contactEmail}
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          Posted {formatPostedAt(listing.postedAt)}
        </span>
        {footer}
      </div>
    </div>
  );
}
