import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import { resortTheme } from "@/components/owner/portalTheme";

/**
 * Resort switcher for owners who hold weeks at both Spicebush and Swallowtail.
 *
 * Weeks, listings and inquiries are already joint across the two portals. The
 * association pages are not, and cannot be: two associations with separate
 * boards, bylaws and payment routes. Without this, an owner in both resorts
 * had to know the other portal's URL and sign in again [scott, 2026-09-13].
 *
 * Owners with weeks in a single resort get one entry and see nothing.
 */

export function useAssociationSite() {
  const { siteSlug } = useSiteFlags();
  const resorts = useQuery(api.ownerPortal.myResorts, { siteSlug });
  const [selected, setSelected] = useState(siteSlug);

  // If the signed-in portal changes, follow it rather than stranding the user
  // on a resort they navigated away from.
  useEffect(() => {
    setSelected(siteSlug);
  }, [siteSlug]);

  return {
    portalSlug: siteSlug,
    siteSlug: selected,
    setSiteSlug: setSelected,
    resorts: resorts ?? [],
    multi: (resorts?.length ?? 0) > 1,
  };
}

export function ResortSwitch({
  resorts,
  value,
  onChange,
}: {
  resorts: { siteSlug: string; name: string }[];
  value: string;
  onChange: (slug: string) => void;
}) {
  if (resorts.length < 2) return null;

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
      {resorts.map((r) => {
        const active = r.siteSlug === value;
        const theme = resortTheme(r.siteSlug);
        return (
          <button
            key={r.siteSlug}
            onClick={() => onChange(r.siteSlug)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active ? "text-white shadow-sm" : "text-slate-600 hover:bg-white"
            }`}
            style={active ? { background: theme.accent } : undefined}
          >
            {r.name}
          </button>
        );
      })}
    </div>
  );
}
