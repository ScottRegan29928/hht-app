import {
  Snowflake,
  Car,
  UtensilsCrossed,
  Microwave,
  Home,
  Trees,
  Compass,
  Wifi,
  ShieldCheck,
  Waves,
  Laptop,
  type LucideIcon,
} from "lucide-react";

/** Maps snake_case DB keys to an icon + display label. */
const CATEGORY_META: Record<
  string,
  { icon: LucideIcon; label: string; color: string }
> = {
  heating_and_cooling: { icon: Snowflake, label: "Climate", color: "oklch(0.55 0.15 230)" },
  garage_and_parking: { icon: Car, label: "Parking", color: "oklch(0.50 0.12 280)" },
  kitchen_and_dining: { icon: UtensilsCrossed, label: "Kitchen & Dining", color: "oklch(0.55 0.14 30)" },
  appliances: { icon: Microwave, label: "Appliances", color: "oklch(0.50 0.12 60)" },
  interior_features: { icon: Home, label: "Interior", color: "oklch(0.50 0.10 200)" },
  exterior_features: { icon: Trees, label: "Outdoor", color: "oklch(0.52 0.14 145)" },
  views_and_location: { icon: Waves, label: "Views & Location", color: "oklch(0.50 0.14 210)" },
  activities: { icon: Compass, label: "Activities", color: "oklch(0.55 0.12 90)" },
  utilities: { icon: Wifi, label: "Utilities", color: "oklch(0.48 0.10 250)" },
  security: { icon: ShieldCheck, label: "Access & Security", color: "oklch(0.45 0.10 300)" },
  essentials: { icon: Laptop, label: "Essentials", color: "oklch(0.50 0.08 220)" },
};

/** Ordered list so the grid renders in a consistent sequence. */
const CATEGORY_ORDER = [
  "heating_and_cooling",
  "kitchen_and_dining",
  "appliances",
  "interior_features",
  "garage_and_parking",
  "exterior_features",
  "views_and_location",
  "activities",
  "utilities",
  "security",
  "essentials",
];

interface FeatureGridProps {
  features: Record<string, string | undefined>;
}

export function FeatureGrid({ features }: FeatureGridProps) {
  const items = CATEGORY_ORDER.filter(
    (key) => features[key] && features[key]!.trim().length > 0
  );

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((key) => {
        const meta = CATEGORY_META[key] ?? {
          icon: Home,
          label: key,
          color: "oklch(0.50 0.08 220)",
        };
        const Icon = meta.icon;
        const value = features[key]!.trim();

        // Split comma-separated values into individual items
        const featureItems = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        return (
          <div
            key={key}
            className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md"
          >
            {/* Category header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 bg-muted/30">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)` }}
              >
                <Icon
                  className="w-4 h-4"
                  strokeWidth={2}
                  style={{ color: meta.color }}
                />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {meta.label}
              </h4>
            </div>
            {/* Feature items */}
            <div className="px-4 py-3">
              {featureItems.length <= 1 ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {value}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {featureItems.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span
                        className="mt-2 w-1 h-1 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
