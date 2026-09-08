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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function AdminBlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const existing = useQuery(
    api.content.adminGetPost,
    isNew ? "skip" : { postId: id as any }
  );
  const savePost = useMutation(api.content.savePost);
  const deletePost = useMutation(api.content.deletePost);

  const [siteSlug, setSiteSlug] = useState("mhht");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [seo, setSeo] = useState<SeoValue>({});
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setExcerpt(existing.excerpt ?? "");
    setCoverImageUrl(existing.coverImageUrl ?? "");
    setAuthorName(existing.authorName ?? "");
    setTagsText((existing.tags ?? []).join(", "));
    setStatus(existing.status);
    setSeo(existing.seo ?? {});
  }, [existing, isNew]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Give the post a title first");
      return;
    }
    setSaving(true);
    try {
      const res = await savePost({
        postId: isNew ? undefined : (id as any),
        siteSlug,
        slug: slug || slugify(title),
        title,
        body,
        excerpt: excerpt || undefined,
        coverImageUrl: coverImageUrl || undefined,
        authorName: authorName || undefined,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status,
        seo: Object.keys(seo).length ? seo : undefined,
      });
      toast.success(status === "published" ? "Post published" : "Draft saved");
      if (isNew) navigate(`/management/blog/${res.postId}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.message?.replace(/^.*Error:\s*/, "") ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete "${title}"? This removes the post from the live site immediately and cannot be undone.`
      )
    )
      return;
    await deletePost({ postId: id as any });
    toast.success("Post deleted");
    navigate("/management/blog");
  };

  if (!isNew && existing === undefined) {
    return (
      <div className="p-8 animate-pulse text-muted-foreground">Loading…</div>
    );
  }
  if (!isNew && existing === null) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground mb-4">That post no longer exists.</p>
        <Link to="/management/blog" className="text-primary hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <Link
        to="/management/blog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Blog
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "New post" : title || "Untitled post"}
        </h1>
        <div className="flex items-center gap-2">
          {!isNew && (
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

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <SitePicker value={siteSlug} onChange={setSiteSlug} disabled={!isNew} />
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
            placeholder="Five quiet beaches in Sea Pines"
            className="w-full px-3 py-2 border rounded-lg bg-background text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Post URL</label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">
              /blog/
            </span>
            <input
              value={slug}
              onChange={(e) => {
                slugTouched.current = true;
                setSlug(e.target.value);
              }}
              placeholder={slugify(title) || "five-quiet-beaches"}
              className="flex-1 px-3 py-2 border rounded-lg bg-background font-mono text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">Author</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tags</label>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Beaches, Things to do"
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate with commas. Tags become filters on /blog.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Cover image URL
          </label>
          <input
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…/beach.jpg"
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt=""
              className="mt-2 rounded-lg max-h-40 object-cover border"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Summary
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="Shown on the blog index. Left empty, the first lines of the article are used."
            className="w-full px-3 py-2 border rounded-lg bg-background resize-y"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium">Article</label>
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
                rows={20}
                placeholder={"Write the article here.\n\n## A section\n\n- A point"}
                className="w-full px-3 py-2 border rounded-lg bg-background font-mono text-sm resize-y"
              />
              <MarkdownHint />
            </>
          )}
        </div>

        <SeoFieldset
          value={seo}
          onChange={setSeo}
          fallbackTitle={title}
          fallbackDescription={excerpt || "Defaults to the summary"}
        />
      </div>
    </div>
  );
}
