/**
 * Amenity filter registry [scott, 2026-09-16].
 *
 *   "in the admin portal, to allow the admin to toggle on and off amenities
 *    for a page, and also toggle on and off amenities that will be used as
 *    search filters"
 *   "Across all four but with the ability to toggle on and off per site."
 *
 * This screen owns the SEARCH FILTER half. The per-page half lives on each
 * property's edit screen, because it is a property-by-property decision.
 *
 * The match counts are the reason this screen is a table and not a list of
 * switches: enabling a filter that matches 0 properties gives visitors a dead
 * end, and enabling one that matches all 82 filters nothing.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { SlidersHorizontal, RotateCcw, Info } from "lucide-react";

const SITES = [
  { slug: "mhht", label: "Hilton Head Timeshares" },
  { slug: "heritage", label: "Heritage Vacations" },
  { slug: "swallowtail", label: "Swallowtail" },
  { slug: "spicebush", label: "Spicebush" },
];

interface RegistryRow {
  id: string;
  label: string;
  kind: "facet" | "tag";
  matchCount: number;
  totalProperties: number;
  filterEnabled: boolean;
  siteDisabled: string[];
  isDefault: boolean;
  note?: string;
}

export function AdminAmenitiesPage() {
  const rows = useQuery(api.amenitySettings.listRegistry) as
    | RegistryRow[]
    | undefined;
  const setFilterEnabled = useMutation(api.amenitySettings.setFilterEnabled);
  const setSiteEnabled = useMutation(api.amenitySettings.setSiteEnabled);
  const resetToDefault = useMutation(api.amenitySettings.resetToDefault);
  const [showAllTags, setShowAllTags] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (rows === undefined) {
    return <div className="p-8 text-muted-foreground">Loading amenities…</div>;
  }

  const facets = rows.filter((r) => r.kind === "facet");
  const tags = rows.filter((r) => r.kind === "tag");
  const promotedTags = tags.filter((r) => r.filterEnabled);
  const visibleTags = showAllTags ? tags : promotedTags;

  const guard = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const renderRow = (r: RegistryRow) => {
    const coverage =
      r.totalProperties > 0
        ? Math.round((r.matchCount / r.totalProperties) * 100)
        : 0;
    // Flag the two useless extremes rather than blocking them: the admin may
    // be enabling a filter ahead of supplying the data.
    const warn =
      r.filterEnabled && r.matchCount === 0
        ? "Matches no properties — this filter returns an empty result set."
        : r.filterEnabled && r.matchCount === r.totalProperties
          ? "Matches every property, so it does not narrow anything."
          : null;

    return (
      <tr key={r.id} className="border-b last:border-0 align-top">
        <td className="py-3 pr-4">
          <div className="font-medium">{r.label}</div>
          {r.note ? (
            <div className="text-xs text-muted-foreground mt-0.5 max-w-sm">
              {r.note}
            </div>
          ) : null}
          {warn ? (
            <div className="text-xs text-amber-700 mt-0.5 flex items-start gap-1 max-w-sm">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{warn}</span>
            </div>
          ) : null}
        </td>
        <td className="py-3 pr-4 whitespace-nowrap text-sm text-muted-foreground">
          {r.matchCount} of {r.totalProperties}
          <span className="text-xs ml-1">({coverage}%)</span>
        </td>
        <td className="py-3 pr-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={r.filterEnabled}
              disabled={busy === r.id}
              onChange={(e) =>
                guard(r.id, () =>
                  setFilterEnabled({
                    amenityId: r.id,
                    enabled: e.target.checked,
                  }),
                )
              }
            />
            <span className="text-sm">
              {r.filterEnabled ? "Filter" : "Off"}
            </span>
          </label>
        </td>
        {SITES.map((site) => {
          const off = r.siteDisabled.includes(site.slug);
          return (
            <td key={site.slug} className="py-3 pr-4 text-center">
              <input
                type="checkbox"
                className="h-4 w-4"
                aria-label={`${r.label} on ${site.label}`}
                checked={r.filterEnabled && !off}
                // A site toggle is meaningless while the amenity is off
                // globally — the global switch is the ceiling.
                disabled={!r.filterEnabled || busy === r.id}
                onChange={(e) =>
                  guard(r.id, () =>
                    setSiteEnabled({
                      amenityId: r.id,
                      siteSlug: site.slug,
                      enabled: e.target.checked,
                    }),
                  )
                }
              />
            </td>
          );
        })}
        <td className="py-3 text-right">
          {!r.isDefault ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              disabled={busy === r.id}
              onClick={() =>
                guard(r.id, async () => {
                  await resetToDefault({ amenityId: r.id });
                  toast.success(`${r.label} reset to default`);
                })
              }
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/60">default</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="flex items-start gap-3 mb-2">
        <SlidersHorizontal className="h-6 w-6 mt-0.5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">Search Filters</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Choose which amenities visitors can filter by. The list is shared
            across all four sites; use the site columns to switch one off for a
            single site. To hide an amenity from one property&rsquo;s page,
            use the Amenities section on that property.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto mt-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Amenity</th>
              <th className="py-2 pr-4 font-medium">Properties</th>
              <th className="py-2 pr-4 font-medium">All sites</th>
              {SITES.map((s) => (
                <th
                  key={s.slug}
                  className="py-2 pr-4 font-medium text-center max-w-[5rem]"
                >
                  {s.label}
                </th>
              ))}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4 + SITES.length}
                className="pt-5 pb-2 text-xs uppercase tracking-wider text-muted-foreground font-medium"
              >
                Standard filters
              </td>
            </tr>
            {facets.map(renderRow)}

            <tr>
              <td
                colSpan={4 + SITES.length}
                className="pt-6 pb-2 text-xs uppercase tracking-wider text-muted-foreground font-medium"
              >
                From HostAway ({promotedTags.length} of {tags.length} used as
                filters)
              </td>
            </tr>
            {visibleTags.length > 0 ? (
              visibleTags.map(renderRow)
            ) : (
              <tr>
                <td
                  colSpan={4 + SITES.length}
                  className="py-3 text-sm text-muted-foreground"
                >
                  None promoted to filters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
        onClick={() => setShowAllTags((v) => !v)}
      >
        {showAllTags
          ? "Hide unused HostAway amenities"
          : `Show all ${tags.length} HostAway amenities`}
      </button>
    </div>
  );
}
