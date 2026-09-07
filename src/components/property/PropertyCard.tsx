import { Link } from "react-router-dom";
import { Bed, Bath, MapPin, DollarSign, Moon } from "lucide-react";

interface PropertyCardProps {
  property: {
    _id: string;
    address: string;
    slug: string;
    bedrooms: number;
    bathrooms: number;
    communityName: string;
    communitySlug: string;
    photoUrl?: string | null;
    isFeatured?: boolean | null;
    nightlyRate?: number | null;
    lowestSalePrice?: number | null;
    saleWeekCount?: number | null;
  };
  mode?: string; // "buy" | "rent"
  checkIn?: string;
  checkOut?: string;
}

export function PropertyCard({ property, mode, checkIn, checkOut }: PropertyCardProps) {
  // Build link with mode context so property page knows the intent
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (checkIn) params.set("checkIn", checkIn);
  if (checkOut) params.set("checkOut", checkOut);
  const qs = params.toString();
  const href = `/property/${property.slug}${qs ? `?${qs}` : ""}`;

  return (
    <Link
      to={href}
      className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-xl"
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
        {property.photoUrl ? (
          <img
            src={property.photoUrl}
            alt={property.address}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <MapPin className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        {property.isFeatured && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-accent text-accent-foreground rounded-md text-xs font-semibold uppercase tracking-wide">
            Featured
          </div>
        )}
        {/* Price badge */}
        {mode === "rent" && property.nightlyRate && (
          <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white rounded-lg text-sm font-semibold">
            ${property.nightlyRate}/night
          </div>
        )}
        {mode === "buy" && property.lowestSalePrice && (
          <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white rounded-lg text-sm font-semibold">
            From ${property.lowestSalePrice.toLocaleString()}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors font-[family-name:var(--font-display)]">
          {property.address}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          {property.communityName}
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Bed className="w-4 h-4" />
            {property.bedrooms} {property.bedrooms === 1 ? "Bed" : "Beds"}
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="w-4 h-4" />
            {property.bathrooms}{" "}
            {property.bathrooms === 1 ? "Bath" : "Baths"}
          </span>
        </div>
        {/* Mode-specific info */}
        {mode === "rent" && property.nightlyRate && (
          <p className="mt-2 text-sm font-medium text-primary flex items-center gap-1">
            <Moon className="w-3.5 h-3.5" />
            ${property.nightlyRate}/night
          </p>
        )}
        {mode === "buy" && property.saleWeekCount && property.saleWeekCount > 0 && (
          <p className="mt-2 text-sm font-medium text-primary flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            {property.saleWeekCount} {property.saleWeekCount === 1 ? "week" : "weeks"} available
          </p>
        )}
      </div>
    </Link>
  );
}
