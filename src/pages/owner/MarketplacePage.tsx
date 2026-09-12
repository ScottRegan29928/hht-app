import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Tag, Search, Repeat, Info, SlidersHorizontal, X } from "lucide-react";
import { ListingCard } from "@/components/owner/ListingCard";
import { useSiteFlags } from "@/lib/siteContext";
import {
  resortTheme,
  KIND_STYLES,
  COMMUNITY_LABELS,
} from "@/components/owner/portalTheme";

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
  const [community, setCommunity] = useState<string>("");
  const [week, setWeek] = useState<string>("");
  const { siteSlug } = useSiteFlags();
  const theme = resortTheme(siteSlug);

  const listings = useQuery(api.marketplace.listPool, {
    kind: tab,
    ...(community ? { communitySlug: community } : {}),
    ...(week ? { weekNumber: Number(week) } : {}),
  });
  const counts = useQuery(api.marketplace.poolCounts);
  // Only offer filter values that exist in the pool — a dropdown of 53 weeks
  // where 40 return nothing is worse than no dropdown.
  const facets = useQuery(api.marketplace.poolFacets, {});

  const active = TABS.find((t) => t.key === tab)!;
  const filtered = !!community || !!week;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Owner Marketplace</h1>
        <p className="text-slate-500 text-sm mt-1">
          Listings are shared between Swallowtail and Spicebush owners — you see
          both communities here, whichever portal you signed in through.
        </p>
      </div>

      {/* Kind tabs, each in its own color so the three intentions stay distinct */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = counts?.[t.key];
          const isActive = t.key === tab;
          const style = KIND_STYLES[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                isActive
                  ? `${style.chip} shadow-sm`
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
                    isActive ? "bg-white/70" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-slate-500">{active.blurb}</p>

      {/* Filters [scott, 2026-09-12] */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 pl-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter
        </span>

        {/* Each control sits in its own fixed-width box rather than relying on
            the select's intrinsic width: some browser extensions wrap native
            selects in a container of their own, and an unwrapped select then
            stretches across the whole filter bar. */}
        <label className="sr-only" htmlFor="mkt-community">
          Community
        </label>
        <div className="w-[12rem]">
          <select
            id="mkt-community"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ["--tw-ring-color" as any]: theme.accent }}
          >
            <option value="">All communities</option>
            {facets?.communities.map((c: any) => (
              <option key={c.slug} value={c.slug}>
                {COMMUNITY_LABELS[c.slug] ?? c.slug} ({c.count})
              </option>
            ))}
          </select>
        </div>

        <label className="sr-only" htmlFor="mkt-week">
          Week number
        </label>
        <div className="w-[9rem]">
          <select
            id="mkt-week"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ["--tw-ring-color" as any]: theme.accent }}
          >
            <option value="">Any week</option>
            {facets?.weeks.map((w: number) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>

        {filtered && (
          <button
            onClick={() => {
              setCommunity("");
              setWeek("");
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}

        {listings !== undefined && (
          <span className="ml-auto text-xs text-slate-400 pr-1">
            {listings.length} shown
          </span>
        )}
      </div>

      {tab === "trade" && (
        <div className="flex gap-3 items-start bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
          <p className="text-amber-900/80">
            Trades are arranged directly between owners and finalized on a
            signed Internal Trade Form Agreement, which carries a $75 fee. This
            page introduces the two owners; it does not complete the trade.
          </p>
        </div>
      )}

      {listings === undefined ? (
        <div className="py-16 text-center text-slate-400 animate-pulse">
          Loading listings…
        </div>
      ) : listings.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-xl bg-white">
          <p className="font-medium text-slate-700">
            {filtered
              ? "No listings match those filters"
              : `No ${active.label.toLowerCase()} listings`}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {filtered
              ? "Try a different community or week."
              : "Check back soon, or post your own from My Listings."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l: any) => (
            <ListingCard key={l._id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
