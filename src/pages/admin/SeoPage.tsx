import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Search, ExternalLink, Info } from "lucide-react";

/**
 * Site-wide SEO defaults, one card per sister site.
 *
 * These fill in whatever an individual page or post leaves blank, so the
 * client sets them once per site rather than repeating a description on
 * every page.
 */
export function AdminSeoPage() {
  const sites = useQuery(api.sites.listSites, {});
  const saveDefaults = useMutation(api.content.saveSeoDefaults);

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">SEO settings</h1>
        <p className="text-muted-foreground">
          Site-wide defaults. Any page or post that leaves a field blank
          inherits these.
        </p>
      </div>

      <div className="border rounded-xl p-4 mb-8 bg-blue-50/50 border-blue-200 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium mb-1">
            Titles, descriptions and sitemaps are live.
          </p>
          <p className="text-muted-foreground">
            Each site serves its own <code className="font-mono">robots.txt</code>{" "}
            and <code className="font-mono">sitemap.xml</code>, generated from
            the published pages, posts and properties that site is allowed to
            show. Social share previews (Facebook, LinkedIn, iMessage) need a
            prerender step that is not built yet — those crawlers do not run
            JavaScript, so they currently read the site-wide description rather
            than the per-page one.
          </p>
        </div>
      </div>

      {sites === undefined ? (
        <div className="animate-pulse text-muted-foreground py-12">Loading…</div>
      ) : (
        <div className="space-y-6">
          {sites.map((site: any) => (
            <SiteSeoCard key={site._id} site={site} onSave={saveDefaults} />
          ))}
        </div>
      )}
    </div>
  );
}

function SiteSeoCard({
  site,
  onSave,
}: {
  site: any;
  onSave: ReturnType<typeof useMutation>;
}) {
  const d = site.seoDefaults ?? {};
  const [titleSuffix, setTitleSuffix] = useState(d.titleSuffix ?? "");
  const [metaDescription, setMetaDescription] = useState(
    d.metaDescription ?? ""
  );
  const [ogImageUrl, setOgImageUrl] = useState(d.ogImageUrl ?? "");
  const [twitterHandle, setTwitterHandle] = useState(d.twitterHandle ?? "");
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  // Populate once the query resolves, without stomping on in-progress edits.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setTitleSuffix(d.titleSuffix ?? "");
    setMetaDescription(d.metaDescription ?? "");
    setOgImageUrl(d.ogImageUrl ?? "");
    setTwitterHandle(d.twitterHandle ?? "");
  }, [d.titleSuffix, d.metaDescription, d.ogImageUrl, d.twitterHandle]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        siteId: site._id,
        titleSuffix,
        metaDescription,
        ogImageUrl,
        twitterHandle,
      });
      toast.success(`${site.name} SEO defaults saved`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const descLen = metaDescription.length;

  return (
    <div className="border rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-lg">{site.name}</h2>
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {site.domain}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://${site.domain}/sitemap.xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border hover:bg-muted transition-colors"
          >
            <Search className="w-3 h-3" />
            sitemap.xml
          </a>
          <a
            href={`https://${site.domain}/robots.txt`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border hover:bg-muted transition-colors"
          >
            robots.txt
          </a>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Title suffix
          </label>
          <input
            value={titleSuffix}
            onChange={(e) => setTitleSuffix(e.target.value)}
            placeholder={` | ${site.name}`}
            className="w-full px-3 py-2 border rounded-lg bg-background font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Appended to every page title. Include the leading separator, for
            example{" "}
            <code className="font-mono">{` | ${site.name}`}</code>.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Default meta description
            {descLen > 0 && (
              <span
                className={`text-xs ml-2 font-normal ${
                  descLen > 160 ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                {descLen}/160
              </span>
            )}
          </label>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
            placeholder="Used on any page without its own description."
            className="w-full px-3 py-2 border rounded-lg bg-background resize-y"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Default share image URL
            </label>
            <input
              value={ogImageUrl}
              onChange={(e) => setOgImageUrl(e.target.value)}
              placeholder="https://…/share.jpg"
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              X / Twitter handle
            </label>
            <input
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              placeholder="@handle"
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
