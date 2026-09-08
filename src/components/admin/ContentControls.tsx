import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

// Shared controls for the content editors. One backend manages four sister
// sites, so every content screen needs an explicit site selector — there is no
// "current site" in the admin portal the way there is on the public sites.

export type SeoValue = {
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  noindex?: boolean;
};

export function useSitesList() {
  return useQuery(api.sites.listSites, {});
}

export function SitePicker({
  value,
  onChange,
  disabled,
  label = "Site",
  includeAll = false,
}: {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  label?: string;
  includeAll?: boolean;
}) {
  const sites = useSitesList();
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-background disabled:opacity-60"
      >
        {includeAll && <option value="">All sites</option>}
        {(sites ?? []).map((s: any) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
      {disabled && (
        <p className="text-xs text-muted-foreground mt-1">
          The site cannot be changed after creation — create a new record on the
          other site instead.
        </p>
      )}
    </div>
  );
}

const LIMITS = { title: 60, description: 160 };

/** Character counter that turns amber past the length Google will show. */
function Counter({ value, limit }: { value: string; limit: number }) {
  const n = value.length;
  if (n === 0) return null;
  return (
    <span
      className={`text-xs ml-2 ${
        n > limit ? "text-amber-600 font-medium" : "text-muted-foreground"
      }`}
    >
      {n}/{limit}
      {n > limit && " — may be truncated in search results"}
    </span>
  );
}

export function SeoFieldset({
  value,
  onChange,
  fallbackTitle,
  fallbackDescription,
}: {
  value: SeoValue;
  onChange: (v: SeoValue) => void;
  fallbackTitle?: string;
  fallbackDescription?: string;
}) {
  const set = (patch: Partial<SeoValue>) => onChange({ ...value, ...patch });

  return (
    <div className="border rounded-xl p-5 space-y-4 bg-muted/20">
      <div>
        <h3 className="font-semibold">Search engine listing</h3>
        <p className="text-sm text-muted-foreground">
          Leave a field empty to fall back to the page content, then to the
          site-wide defaults under SEO settings.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Meta title
          <Counter value={value.metaTitle ?? ""} limit={LIMITS.title} />
        </label>
        <input
          value={value.metaTitle ?? ""}
          onChange={(e) => set({ metaTitle: e.target.value })}
          placeholder={fallbackTitle || "Defaults to the title above"}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Meta description
          <Counter
            value={value.metaDescription ?? ""}
            limit={LIMITS.description}
          />
        </label>
        <textarea
          value={value.metaDescription ?? ""}
          onChange={(e) => set({ metaDescription: e.target.value })}
          rows={2}
          placeholder={fallbackDescription || "Defaults to the excerpt"}
          className="w-full px-3 py-2 border rounded-lg bg-background resize-y"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Social share image URL
          </label>
          <input
            value={value.ogImageUrl ?? ""}
            onChange={(e) => set({ ogImageUrl: e.target.value })}
            placeholder="https://…/share.jpg"
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Canonical URL
          </label>
          <input
            value={value.canonicalUrl ?? ""}
            onChange={(e) => set({ canonicalUrl: e.target.value })}
            placeholder="Defaults to this page's own address"
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.noindex ?? false}
          onChange={(e) => set({ noindex: e.target.checked })}
          className="mt-1"
        />
        <span className="text-sm">
          <span className="font-medium">Hide from search engines</span>
          <span className="block text-muted-foreground text-xs">
            Adds a noindex tag and leaves this out of sitemap.xml. Use for
            thank-you and landing pages.
          </span>
        </span>
      </label>
    </div>
  );
}

/** Draft/published toggle used by both editors. */
export function StatusPicker({
  value,
  onChange,
}: {
  value: "draft" | "published";
  onChange: (v: "draft" | "published") => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">Status</label>
      <div className="flex gap-2">
        {(["draft", "published"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${
              value === s
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {value === "draft"
          ? "Only visible here in the admin portal."
          : "Live on the public site."}
      </p>
    </div>
  );
}

/** Live markdown help, shown beside the body editor. */
export function MarkdownHint() {
  return (
    <p className="text-xs text-muted-foreground mt-1.5">
      Formatting: <code className="font-mono">## Heading</code>,{" "}
      <code className="font-mono">**bold**</code>,{" "}
      <code className="font-mono">*italic*</code>,{" "}
      <code className="font-mono">- bullet</code>,{" "}
      <code className="font-mono">[link](https://…)</code>,{" "}
      <code className="font-mono">![alt](image-url)</code>
    </p>
  );
}
