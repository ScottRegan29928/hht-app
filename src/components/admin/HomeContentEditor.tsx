import { useState } from "react";
import { useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Upload, X, Plus, ImageIcon } from "lucide-react";
import {
  defaultHomeContent,
  type HomeContent,
  type TileItem,
} from "@/lib/homeContent";

/**
 * Field-by-field editor for the home page.
 *
 * The layout is code, so instead of a blank content box this exposes the exact
 * slots the design has: hero copy and images, section headings, tiles, and the
 * closing band. Leaving a field empty restores the designed default rather
 * than blanking the live page, and the placeholder shows what that default is,
 * so an admin can always see what they are overriding.
 */

type Props = {
  siteSlug: string;
  value: HomeContent;
  onChange: (next: HomeContent) => void;
};

function Field({
  label,
  hint,
  value,
  placeholder,
  onChange,
  multiline,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const cls =
    "w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl p-5">
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          {description}
        </p>
      )}
      <div className="space-y-4 mt-4">{children}</div>
    </div>
  );
}

export function HomeContentEditor({ siteSlug, value, onChange }: Props) {
  const generateUploadUrl = useMutation(api.admin.generateUploadUrl);
  const convex = useConvex();
  const [uploading, setUploading] = useState<string | null>(null);
  const defaults = defaultHomeContent(siteSlug);

  const patch = (part: Partial<HomeContent>) => onChange({ ...value, ...part });

  const upload = async (file: File, key: string): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image");
      return null;
    }
    setUploading(key);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();
      // Store the resolved file URL, so the public page needs no extra lookup.
      const fileUrl = await convex.query(api.admin.getStorageUrl, { storageId });
      if (!fileUrl) throw new Error("No URL for the uploaded file");
      return fileUrl;
    } catch {
      toast.error("Could not upload that image — try again");
      return null;
    } finally {
      setUploading(null);
    }
  };

  const heroImages = value.hero.images;
  const tiles = value.tiles.items;

  const setTile = (i: number, part: Partial<TileItem>) => {
    const next = tiles.map((t, j) => (j === i ? { ...t, ...part } : t));
    patch({ tiles: { ...value.tiles, items: next } });
  };

  return (
    <div className="space-y-5">
      <Section
        title="Hero"
        description={
          siteSlug === "mhht"
            ? "This site has no hero banner — the map is the hero, so these fields are unused here."
            : "The banner at the top of the home page."
        }
      >
        <Field
          label="Headline"
          hint="One line per line break. The design sets the line breaks, so keep lines short."
          multiline
          value={value.hero.headlineLines.join("\n")}
          placeholder={defaults.hero.headlineLines.join("\n")}
          onChange={(v) =>
            patch({
              hero: {
                ...value.hero,
                headlineLines: v.split("\n").map((l) => l.trim()),
              },
            })
          }
        />
        <Field
          label="Intro paragraph"
          multiline
          value={value.hero.intro}
          placeholder={defaults.hero.intro}
          onChange={(v) => patch({ hero: { ...value.hero, intro: v } })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First button — label"
            hint="Rentals always come first."
            value={value.hero.primaryLabel}
            placeholder={defaults.hero.primaryLabel}
            onChange={(v) => patch({ hero: { ...value.hero, primaryLabel: v } })}
          />
          <Field
            label="First button — link"
            value={value.hero.primaryHref}
            placeholder={defaults.hero.primaryHref}
            onChange={(v) => patch({ hero: { ...value.hero, primaryHref: v } })}
          />
          <Field
            label="Second button — label"
            value={value.hero.secondaryLabel}
            placeholder={defaults.hero.secondaryLabel}
            onChange={(v) =>
              patch({ hero: { ...value.hero, secondaryLabel: v } })
            }
          />
          <Field
            label="Second button — link"
            value={value.hero.secondaryHref}
            placeholder={defaults.hero.secondaryHref}
            onChange={(v) =>
              patch({ hero: { ...value.hero, secondaryHref: v } })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Hero images
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Two or more images rotate as a slideshow. One image stays still.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {heroImages.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative group rounded-lg overflow-hidden border aspect-[16/10] bg-muted"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      hero: {
                        ...value.hero,
                        images: heroImages.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove image ${i + 1}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center gap-1.5 aspect-[16/10] rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/40 transition-colors text-muted-foreground">
              {uploading === "hero" ? (
                <span className="text-xs">Uploading…</span>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Add image</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const url = await upload(file, "hero");
                  if (url)
                    patch({
                      hero: { ...value.hero, images: [...heroImages, url] },
                    });
                }}
              />
            </label>
          </div>
        </div>
      </Section>

      <Section
        title="Map section"
        description="The interactive community map."
      >
        <Field
          label="Heading"
          value={value.map.heading}
          placeholder={defaults.map.heading}
          onChange={(v) => patch({ map: { ...value.map, heading: v } })}
        />
        <Field
          label="Intro"
          multiline
          value={value.map.intro}
          placeholder={defaults.map.intro}
          onChange={(v) => patch({ map: { ...value.map, intro: v } })}
        />
      </Section>

      {tiles.length > 0 && (
        <Section
          title="Shortcut tiles"
          description="The four image tiles that link into a filtered search."
        >
          <Field
            label="Heading"
            value={value.tiles.heading}
            placeholder={defaults.tiles.heading}
            onChange={(v) => patch({ tiles: { ...value.tiles, heading: v } })}
          />
          <Field
            label="Subheading"
            multiline
            value={value.tiles.subheading}
            placeholder={defaults.tiles.subheading}
            onChange={(v) => patch({ tiles: { ...value.tiles, subheading: v } })}
          />
          <div className="space-y-3">
            {tiles.map((t, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row gap-3 border rounded-lg p-3"
              >
                <div className="sm:w-40 shrink-0">
                  <div className="relative rounded-md overflow-hidden border aspect-[279/239] bg-muted">
                    {t.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <label className="mt-2 flex items-center justify-center gap-1.5 text-xs rounded-md border py-1.5 cursor-pointer hover:bg-muted transition-colors">
                    {uploading === `tile-${i}` ? (
                      "Uploading…"
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Replace
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const url = await upload(file, `tile-${i}`);
                        if (url) setTile(i, { imageUrl: url });
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1 space-y-3">
                  <Field
                    label="Label"
                    value={t.label}
                    onChange={(v) => setTile(i, { label: v })}
                  />
                  <Field
                    label="Link"
                    hint="Where the tile goes when clicked."
                    value={t.href}
                    onChange={(v) => setTile(i, { href: v })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      tiles: {
                        ...value.tiles,
                        items: tiles.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="self-start p-1.5 text-red-600 rounded-md hover:bg-red-50"
                  aria-label={`Remove tile ${i + 1}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {tiles.length < 8 && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    tiles: {
                      ...value.tiles,
                      items: [
                        ...tiles,
                        { label: "New tile", imageUrl: "", href: "/search?type=rent" },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add tile
              </button>
            )}
          </div>
        </Section>
      )}

      <Section title="Communities section">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Heading"
            value={value.communities.heading}
            placeholder={defaults.communities.heading}
            onChange={(v) =>
              patch({ communities: { ...value.communities, heading: v } })
            }
          />
          <Field
            label="Subheading"
            value={value.communities.subheading}
            placeholder={defaults.communities.subheading}
            onChange={(v) =>
              patch({ communities: { ...value.communities, subheading: v } })
            }
          />
        </div>
      </Section>

      <Section
        title="Featured villas section"
        description="Which villas appear here is set by the Featured flag on each property."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Heading"
            value={value.featured.heading}
            placeholder={defaults.featured.heading}
            onChange={(v) =>
              patch({ featured: { ...value.featured, heading: v } })
            }
          />
          <Field
            label="Subheading"
            value={value.featured.subheading}
            placeholder={defaults.featured.subheading}
            onChange={(v) =>
              patch({ featured: { ...value.featured, subheading: v } })
            }
          />
        </div>
      </Section>

      <Section
        title="Closing call to action"
        description="The colored band at the very bottom of the home page."
      >
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={value.closing.enabled}
            onChange={(e) =>
              patch({ closing: { ...value.closing, enabled: e.target.checked } })
            }
            className="h-4 w-4 rounded border-input"
          />
          Show this section
        </label>
        {value.closing.enabled && (
          <>
            <Field
              label="Heading"
              value={value.closing.heading}
              placeholder={defaults.closing.heading}
              onChange={(v) =>
                patch({ closing: { ...value.closing, heading: v } })
              }
            />
            <Field
              label="Body"
              multiline
              value={value.closing.body}
              placeholder={defaults.closing.body}
              onChange={(v) => patch({ closing: { ...value.closing, body: v } })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First button — label"
                value={value.closing.primaryLabel}
                placeholder={defaults.closing.primaryLabel}
                onChange={(v) =>
                  patch({ closing: { ...value.closing, primaryLabel: v } })
                }
              />
              <Field
                label="First button — link"
                value={value.closing.primaryHref}
                placeholder={defaults.closing.primaryHref}
                onChange={(v) =>
                  patch({ closing: { ...value.closing, primaryHref: v } })
                }
              />
              <Field
                label="Second button — label"
                value={value.closing.secondaryLabel}
                placeholder={defaults.closing.secondaryLabel}
                onChange={(v) =>
                  patch({ closing: { ...value.closing, secondaryLabel: v } })
                }
              />
              <Field
                label="Second button — link"
                value={value.closing.secondaryHref}
                placeholder={defaults.closing.secondaryHref}
                onChange={(v) =>
                  patch({ closing: { ...value.closing, secondaryHref: v } })
                }
              />
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
