import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Tag, Search, Repeat, Info } from "lucide-react";
import { ListingCard } from "@/components/owner/ListingCard";

type Kind = "for_sale" | "want_to_buy" | "trade";

const TABS: { key: Kind; label: string; icon: typeof Tag; blurb: string }[] = [
  {
    key: "for_sale",
    label: "For Sale",
    icon: Tag,
    blurb:
      "Weeks other owners are selling. Prices are set by the owner — contact them directly.",
  },
  {
    key: "want_to_buy",
    label: "Want to Buy",
    icon: Search,
    blurb: "Owners looking to buy a week. Get in touch if yours is a match.",
  },
  {
    key: "trade",
    label: "Internal Trade",
    icon: Repeat,
    blurb:
      "One-time week swaps between owners — not a permanent exchange of ownership.",
  },
];

export function OwnerMarketplacePage() {
  const [tab, setTab] = useState<Kind>("for_sale");
  const listings = useQuery(api.marketplace.listPool, { kind: tab });
  const counts = useQuery(api.marketplace.poolCounts);

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Listings are shared between Swallowtail and Spicebush owners — you see
          both communities here, whichever portal you signed in through.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = counts?.[t.key];
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    isActive ? "bg-primary-foreground/20" : "bg-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{active.blurb}</p>

      {tab === "trade" && (
        <div className="flex gap-3 items-start bg-muted/50 border rounded-xl p-4 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Trades are arranged directly between owners and finalized on a
            signed Internal Trade Form Agreement, which carries a $75 fee. This
            page introduces the two owners; it does not complete the trade.
          </p>
        </div>
      )}

      {listings === undefined ? (
        <div className="py-16 text-center text-muted-foreground animate-pulse">
          Loading listings…
        </div>
      ) : listings.length === 0 ? (
        <div className="py-16 text-center border rounded-xl bg-muted/30">
          <p className="font-medium">No {active.label.toLowerCase()} listings</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check back soon, or post your own from My Listings.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l) => (
            <ListingCard key={l._id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
