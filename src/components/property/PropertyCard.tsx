import { Link } from "react-router-dom";
import { Bed, Bath, MapPin } from "lucide-react";

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
  };
}

export function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Link
      to={`/property/${property.slug}`}
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
      </div>
    </Link>
  );
}
