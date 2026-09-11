import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import { FileText, Download, Search } from "lucide-react";

/**
 * The document library — association documents, newsletters, board minutes and
 * forms. Replaces four separate accordion panels on the WordPress portal, where
 * an owner hunting for the 2019 newsletter had to expand a list of 28 links.
 */

const TABS = [
  { key: "association", label: "Association" },
  { key: "newsletter", label: "Newsletters" },
  { key: "minutes", label: "Board Minutes" },
  { key: "stay", label: "Your Stay" },
  { key: "form", label: "Forms" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function yearOf(ms?: number | null) {
  return ms ? new Date(ms).getUTCFullYear() : null;
}

export function OwnerDocumentsPage() {
  const { siteSlug } = useSiteFlags();
  const data = useQuery(api.ownerPortal.overview, { siteSlug });
  const [tab, setTab] = useState<TabKey>("association");
  const [q, setQ] = useState("");

  const groups = data?.documents ?? {};
  const available = useMemo(
    () => TABS.filter((t) => (groups[t.key]?.length ?? 0) > 0),
    [groups]
  );
  // Land on a tab that actually has documents for this resort.
  const activeTab = available.some((t) => t.key === tab)
    ? tab
    : (available[0]?.key ?? "association");

  const docs = (groups[activeTab] ?? []).filter((d: any) =>
    q.trim() ? d.title.toLowerCase().includes(q.trim().toLowerCase()) : true
  );

  if (data === undefined) {
    return (
      <div className="py-20 text-center text-muted-foreground animate-pulse">
        Loading documents…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.documentCount} documents, available only to owners.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {available.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted"
              }`}
            >
              {t.label}
              <span className="ml-1.5 opacity-60">
                {groups[t.key]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="sm:ml-auto relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
            className="pl-9 pr-3 py-2 border rounded-lg bg-background text-sm w-full sm:w-64"
          />
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="border rounded-xl p-10 text-center text-muted-foreground">
          {q ? `Nothing matches “${q}”.` : "No documents in this section yet."}
        </div>
      ) : (
        <ul className="border rounded-xl divide-y overflow-hidden">
          {docs.map((d: any) => (
            <li key={d._id}>
              <a
                href={d.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors group"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium">{d.title}</span>
                {yearOf(d.documentDate) && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {yearOf(d.documentDate)}
                  </span>
                )}
                <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
