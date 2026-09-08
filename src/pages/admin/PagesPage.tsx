import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SitePicker } from "@/components/admin/ContentControls";
import { FileText, Plus, ExternalLink } from "lucide-react";

export function AdminPagesPage() {
  const [siteSlug, setSiteSlug] = useState("");
  const pages = useQuery(api.content.adminListPages, {
    siteSlug: siteSlug || undefined,
  });
  const sites = useQuery(api.sites.listSites, {});
  const siteName = (slug: string) =>
    (sites ?? []).find((s: any) => s.slug === slug)?.name ?? slug;
  const siteDomain = (slug: string) =>
    (sites ?? []).find((s: any) => s.slug === slug)?.domain;

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
          <p className="text-muted-foreground">
            Marketing and information pages for each of the four sites.
          </p>
        </div>
        <Link
          to="/management/pages/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New page
        </Link>
      </div>

      <div className="max-w-xs mb-6">
        <SitePicker
          value={siteSlug}
          onChange={setSiteSlug}
          includeAll
          label="Filter by site"
        />
      </div>

      {pages === undefined ? (
        <div className="animate-pulse text-muted-foreground py-12">Loading…</div>
      ) : pages.length === 0 ? (
        <div className="border rounded-xl py-16 text-center bg-muted/30">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No pages yet</p>
          <p className="text-sm text-muted-foreground">
            Create one to add content beyond the built-in property pages.
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Site</th>
                <th className="px-4 py-3 font-semibold">URL</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Nav</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p: any) => (
                <tr key={p._id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to={`/management/pages/${p._id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {siteName(p.siteSlug)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      /{p.slug}
                      {p.status === "published" && siteDomain(p.siteSlug) && (
                        <a
                          href={`https://${siteDomain(p.siteSlug)}/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary"
                          title="View live"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.status === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.showInNav ? `Yes (${p.sortOrder ?? "—"})` : "No"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(p.updatedAt ?? p.createdAt).toLocaleDateString()}
                    {p.updatedByName && (
                      <span className="block opacity-70">
                        {p.updatedByName}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
