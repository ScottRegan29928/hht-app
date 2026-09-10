import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  SitePicker,
  SeoFieldset,
  StatusPicker,
  MarkdownHint,
  type SeoValue,
} from "@/components/admin/ContentControls";
import { Markdown } from "@/lib/markdown";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Eye, Pencil } from "lucide-react";

/** Mirrors convex/content.ts normalizeSlug so the preview matches what saves. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function AdminPageEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const existing = useQuery(
    api.content.adminGetPage,
    isNew ? "skip" : { pageId: id as any }
  );
  const savePage = useMutation(api.content.savePage);
  const deletePage = useMutation(api.content.deletePage);

  const [siteSlug, setSiteSlug] = useState("mhht");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [showInNav, setShowInNav] = useState(false);
  const [navLabel, setNavLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [seo, setSeo] = useState<SeoValue>({});
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-derive the slug from the title only until the admin edits it by hand,
  // and never for an existing page — changing a live URL silently would break
  // inbound links.
  const slugTouched = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (isNew || !existing || loaded.current) return;
    loaded.current = true;
    slugTouched.current = true;
    setSiteSlug(existing.siteSlug);
    setTitle(existing.title);
    setSlug(existing.slug);
    setBody(existing.body);
    setStatus(existing.status);
    setShowInNav(existing.showInNav);
    setNavLabel(existing.navLabel ?? "");
    setSortOrder(
      existing.sortOrder === undefined ? "" : String(existing.sortOrder)
    );
    setSeo(existing.seo ?? {});
  }, [existing, isNew]);

  // The home page's layout is designed in code, so its editor shows only the
  // fields that actually change the live page: title and SEO [scott, 2026-09-10].
  const isHome = !!existing?.isHome;
  const effectiveSlug = slug || slugify(title);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Give the page a title first");
      return;
    }
    setSaving(true);
    try {
      const res = await savePage({
        pageId: isNew ? undefined : (id as any),
        siteSlug,
        slug: effectiveSlug,
        title,
        body,
        status,
        showInNav,
        navLabel: navLabel || undefined,
        sortOrder: sortOrder === "" ? undefined : Number(sortOrder),
        seo: Object.keys(seo).length ? seo : undefined,
      });
      toast.success(
        status === "published" ? "Page published" : "Draft saved"
      );
      if (isNew) navigate(`/management/pages/${res.pageId}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.message?.replace(/^.*Error:\s*/, "") ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete "${title}"? This removes the page from the live site immediately and cannot be undone.`
      )
    )
      return;
    await deletePage({ pageId: id as any });
    toast.success("Page deleted");
    navigate("/management/pages");
  };

  if (!isNew && existing === undefined) {
    return (
      <div className="p-8 animate-pulse text-muted-foreground">Loading…</div>
    );
  }
  if (!isNew && existing === null) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground mb-4">That page no longer exists.</p>
        <Link to="/management/pages" className="text-primary hover:underline">
          Back to pages
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <Link
        to="/management/pages"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Pages
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "New page" : title || "Untitled page"}
        </h1>
        <div className="flex items-center gap-2">
          {!isNew && !isHome && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : status === "published" ? "Publish" : "Save draft"}
          </button>
        </div>
      </div>

      {isHome && (
        <div className="mb-6 rounded-xl border bg-muted/30 p-5">
          <p className="text-sm">
            This is the site's home page, live at <span className="font-mono">/</span>.
            Its layout &mdash; hero, map, featured villas &mdash; is designed in
            code, so there is no content to edit here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            What you set below does change the live site: the title shown in the
            browser tab and in Google results, and the description and image used
            when the home page is shared on Facebook or LinkedIn.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <SitePicker
            value={siteSlug}
            onChange={setSiteSlug}
            disabled={!isNew}
          />
          <StatusPicker value={status} onChange={setStatus} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Title</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched.current) setSlug(slugify(e.target.value));
            }}
            placeholder="About Sea Pines"
            className="w-full px-3 py-2 border rounded-lg bg-background text-lg"
          />
        </div>

        {!isHome && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Page URL</label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">/</span>
            <input
              value={slug}
              onChange={(e) => {
                slugTouched.current = true;
                setSlug(e.target.value);
              }}
              placeholder={slugify(title) || "about-sea-pines"}
              className="flex-1 px-3 py-2 border rounded-lg bg-background font-mono text-sm"
            />
          </div>
          {!isNew && (
            <p className="text-xs text-amber-600 mt-1">
              Changing this breaks any existing links to the old address.
            </p>
          )}
        </div>
        )}

        {!isHome && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium">Content</label>
            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
            >
              {preview ? (
                <>
                  <Pencil className="w-3 h-3" /> Edit
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" /> Preview
                </>
              )}
            </button>
          </div>
          {preview ? (
            <div className="border rounded-lg p-5 min-h-[24rem] bg-background">
              {body.trim() ? (
                <Markdown source={body} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                placeholder={"## Welcome\n\nWrite the page content here."}
                className="w-full px-3 py-2 border rounded-lg bg-background font-mono text-sm resize-y"
              />
              <MarkdownHint />
            </>
          )}
        </div>
        )}

        {!isHome && (
        <div className="border rounded-xl p-5 space-y-4 bg-muted/20">
          <h3 className="font-semibold">Navigation</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInNav}
              onChange={(e) => setShowInNav(e.target.checked)}
            />
            <span className="text-sm font-medium">
              Show this page in the site menu
            </span>
          </label>
          {showInNav && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Menu label
                </label>
                <input
                  value={navLabel}
                  onChange={(e) => setNavLabel(e.target.value)}
                  placeholder={title || "Defaults to the title"}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Menu order
                </label>
                <input
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="10"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first.
                </p>
              </div>
            </div>
          )}
        </div>
        )}

        <SeoFieldset
          value={seo}
          onChange={setSeo}
          fallbackTitle={title}
          fallbackDescription={
            isHome
              ? "Defaults to the site tagline"
              : "Defaults to the first lines of the content"
          }
        />
      </div>
    </div>
  );
}
