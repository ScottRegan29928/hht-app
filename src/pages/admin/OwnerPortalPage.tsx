import { useEffect, useState } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Upload,
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";

/**
 * Owner Portal — the staff side of the Swallowtail and Spicebush portals.
 *
 * Everything an owner reads in the portal is edited here: the document library,
 * the board roster and the per-resort copy blocks. The portals exist only for
 * those two resorts, so this screen scopes itself to them rather than using the
 * general SitePicker.
 */

type Tab = "documents" | "board" | "settings";

const PORTAL_SITES = [
  { slug: "swallowtail", label: "Swallowtail" },
  { slug: "spicebush", label: "Spicebush" },
];

const CATEGORIES = [
  { key: "association", label: "Association documents" },
  { key: "newsletter", label: "Newsletters" },
  { key: "minutes", label: "Board minutes" },
  { key: "stay", label: "Your stay" },
  { key: "form", label: "Forms" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

export function AdminOwnerPortalPage() {
  const [siteSlug, setSiteSlug] = useState("swallowtail");
  const [tab, setTab] = useState<Tab>("documents");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Owner Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documents, board roster and portal copy for the two owner portals.
          </p>
        </div>
        <div className="flex gap-1.5">
          {PORTAL_SITES.map((s) => (
            <button
              key={s.slug}
              onClick={() => setSiteSlug(s.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                siteSlug === s.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 border-b">
        {(["documents", "board", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "documents" && <DocumentsTab siteSlug={siteSlug} />}
      {tab === "board" && <BoardTab siteSlug={siteSlug} />}
      {tab === "settings" && <SettingsTab siteSlug={siteSlug} />}
    </div>
  );
}

// ── Documents ──────────────────────────────────────────────────────────────

function DocumentsTab({ siteSlug }: { siteSlug: string }) {
  const docs = useQuery(api.ownerPortal.adminListDocuments, { siteSlug });
  const upsert = useMutation(api.ownerPortal.upsertDocument);
  const remove = useMutation(api.ownerPortal.deleteDocument);
  const generateUploadUrl = useMutation(api.admin.generateUploadUrl);

  const [category, setCategory] = useState<Category>("association");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);

  const list = (docs ?? []).filter((d: any) => d.category === category);

  const handleUpload = async (file: File) => {
    if (!title.trim()) {
      toast.error("Give the document a title first");
      return;
    }
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = await res.json();
      await upsert({
        siteSlug,
        category,
        title: title.trim(),
        storageId,
        documentDate: year
          ? Date.UTC(Number(year), 0, 1)
          : undefined,
        published: true,
      });
      toast.success("Document added");
      setTitle("");
      setYear("");
    } catch {
      toast.error("Could not add that document");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === c.key
                ? "bg-foreground text-background"
                : "bg-muted/60 hover:bg-muted"
            }`}
          >
            {c.label}
            <span className="ml-1.5 opacity-60">
              {(docs ?? []).filter((d: any) => d.category === c.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Add a document</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] items-end">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="2026 Spring Newsletter"
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Year</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="2026"
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
            />
          </div>
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:opacity-90">
            <Upload className="w-4 h-4" />
            {busy ? "Uploading…" : "Choose file"}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleUpload(f);
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Files are stored with the site, so they keep working after the old
          WordPress site is retired.
        </p>
      </div>

      {docs === undefined ? (
        <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">
          Loading documents…
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-xl">
          No documents in this section yet.
        </p>
      ) : (
        <ul className="border rounded-xl divide-y">
          {list.map((d: any) => (
            <li key={d._id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium">{d.title}</span>
              {!d.published && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Hidden
                </span>
              )}
              {d.documentDate && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(d.documentDate).getUTCFullYear()}
                </span>
              )}
              {d.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="Open"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={() =>
                  upsert({
                    id: d._id,
                    siteSlug,
                    category: d.category,
                    title: d.title,
                    published: !d.published,
                  }).then(() =>
                    toast.success(d.published ? "Hidden from owners" : "Visible to owners")
                  )
                }
                className="text-muted-foreground hover:text-foreground"
                title={d.published ? "Hide from owners" : "Show to owners"}
              >
                {d.published ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Delete “${d.title}”?`)) return;
                  void remove({ id: d._id }).then(() => toast.success("Deleted"));
                }}
                className="text-red-600 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────

const EMPTY_MEMBER = {
  name: "",
  title: "",
  holdings: "",
  termStart: "",
  termEnd: "",
  termNote: "",
  email: "",
};

function BoardTab({ siteSlug }: { siteSlug: string }) {
  const board = useQuery(api.ownerPortal.adminListBoard, { siteSlug });
  const upsert = useMutation(api.ownerPortal.upsertBoardMember);
  const remove = useMutation(api.ownerPortal.deleteBoardMember);
  const [form, setForm] = useState({ ...EMPTY_MEMBER });

  const save = async (extra?: any) => {
    if (!form.name.trim()) {
      toast.error("A board member needs a name");
      return;
    }
    await upsert({
      siteSlug,
      name: form.name.trim(),
      title: form.title.trim() || undefined,
      holdings: form.holdings.trim() || undefined,
      termStart: form.termStart ? Number(form.termStart) : undefined,
      termEnd: form.termEnd ? Number(form.termEnd) : undefined,
      termNote: form.termNote.trim() || undefined,
      email: form.email.trim() || undefined,
      sortOrder: (board?.length ?? 0) + 1,
      ...extra,
    });
    setForm({ ...EMPTY_MEMBER });
    toast.success("Board updated");
  };

  return (
    <div className="space-y-5">
      {board === undefined ? (
        <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">
          Loading board…
        </p>
      ) : (
        <ul className="border rounded-xl divide-y">
          {board.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No board members yet.
            </li>
          )}
          {board.map((m: any) => (
            <li key={m._id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {m.name}
                  {m.title ? ` · ${m.title}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[
                    m.termStart && m.termEnd ? `${m.termStart}–${m.termEnd}` : null,
                    m.termNote,
                    m.holdings,
                    m.email,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                onClick={() => {
                  if (!confirm(`Remove ${m.name} from the board?`)) return;
                  void remove({ id: m._id }).then(() => toast.success("Removed"));
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Add a board member</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Text
            label="Position"
            placeholder="President"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
          />
          <Text
            label="Units or weeks held"
            placeholder="Unit 587 / Weeks 28, 30"
            value={form.holdings}
            onChange={(v) => setForm({ ...form, holdings: v })}
          />
          <Text
            label="Email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Text
              label="Term start"
              placeholder="2024"
              value={form.termStart}
              onChange={(v) => setForm({ ...form, termStart: v.replace(/\D/g, "").slice(0, 4) })}
            />
            <Text
              label="Term end"
              placeholder="2027"
              value={form.termEnd}
              onChange={(v) => setForm({ ...form, termEnd: v.replace(/\D/g, "").slice(0, 4) })}
            />
          </div>
          <Text
            label="Term note"
            placeholder="Second term"
            value={form.termNote}
            onChange={(v) => setForm({ ...form, termNote: v })}
          />
        </div>
        <button
          onClick={() => void save()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add member
        </button>
      </div>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

function SettingsTab({ siteSlug }: { siteSlug: string }) {
  const saved = useQuery(api.ownerPortal.adminGetSettings, { siteSlug });
  const save = useMutation(api.ownerPortal.saveSettings);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved === undefined) return;
    setF({
      votingEnabled: saved?.votingEnabled ?? false,
      votingLabel: saved?.votingLabel ?? "",
      votingUrl: saved?.votingUrl ?? "",
      rentIntro: saved?.rentIntro ?? "",
      rentContactName: saved?.rentContactName ?? "",
      rentContactPhones: (saved?.rentContactPhones ?? []).join(", "),
      hoaSalesIntro: saved?.hoaSalesIntro ?? "",
      hoaSalesContactName: saved?.hoaSalesContactName ?? "",
      hoaSalesContactPhone: saved?.hoaSalesContactPhone ?? "",
      hoaSalesContactEmail: saved?.hoaSalesContactEmail ?? "",
      regimeManagers: (saved?.regimeManagers ?? [])
        .map((m: any) => `${m.name}${m.email ? ` <${m.email}>` : ""}`)
        .join("\n"),
      regimePhone: saved?.regimePhone ?? "",
      regimeFax: saved?.regimeFax ?? "",
      regimeEmail: saved?.regimeEmail ?? "",
      commentCardIntro: saved?.commentCardIntro ?? "",
      weatherIntro: saved?.weatherIntro ?? "",
      weatherLinks: (saved?.weatherLinks ?? [])
        .map((l: any) => `${l.label} | ${l.url}`)
        .join("\n"),
      tradeFeeNote: saved?.tradeFeeNote ?? "",
    });
  }, [saved, siteSlug]);

  if (!f) {
    return (
      <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">
        Loading settings…
      </p>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        siteSlug,
        votingEnabled: !!f.votingEnabled,
        votingLabel: f.votingLabel || undefined,
        votingUrl: f.votingUrl || undefined,
        rentIntro: f.rentIntro || undefined,
        rentContactName: f.rentContactName || undefined,
        rentContactPhones: f.rentContactPhones
          ? f.rentContactPhones.split(",").map((p: string) => p.trim()).filter(Boolean)
          : undefined,
        hoaSalesIntro: f.hoaSalesIntro || undefined,
        hoaSalesContactName: f.hoaSalesContactName || undefined,
        hoaSalesContactPhone: f.hoaSalesContactPhone || undefined,
        hoaSalesContactEmail: f.hoaSalesContactEmail || undefined,
        regimeManagers: f.regimeManagers
          ? f.regimeManagers
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((line: string) => {
                const m = line.match(/^(.*?)\s*<(.+?)>\s*$/);
                return m
                  ? { name: m[1].trim(), email: m[2].trim() }
                  : { name: line };
              })
          : undefined,
        regimePhone: f.regimePhone || undefined,
        regimeFax: f.regimeFax || undefined,
        regimeEmail: f.regimeEmail || undefined,
        commentCardIntro: f.commentCardIntro || undefined,
        weatherIntro: f.weatherIntro || undefined,
        weatherLinks: f.weatherLinks
          ? f.weatherLinks
              .split("\n")
              .map((line: string) => line.split("|"))
              .filter((parts: string[]) => parts.length >= 2)
              .map((parts: string[]) => ({
                label: parts[0].trim(),
                url: parts.slice(1).join("|").trim(),
              }))
          : undefined,
        tradeFeeNote: f.tradeFeeNote || undefined,
      });
      toast.success("Portal settings saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save");
    }
    setBusy(false);
  };

  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-5">
      <Section title="Voting banner" hint="Shows across the top of every portal page while open.">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={f.votingEnabled}
            onChange={(e) => setF({ ...f, votingEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          Voting is open
        </label>
        {f.votingEnabled && (
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <Text label="Banner text" value={f.votingLabel} onChange={set("votingLabel")} />
            <Text label="Voting link" value={f.votingUrl} onChange={set("votingUrl")} />
          </div>
        )}
      </Section>

      <Section title="Renting an additional week">
        <Area label="Intro" value={f.rentIntro} onChange={set("rentIntro")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Contact name" value={f.rentContactName} onChange={set("rentContactName")} />
          <Text
            label="Phone numbers"
            hint="Comma separated"
            value={f.rentContactPhones}
            onChange={set("rentContactPhones")}
          />
        </div>
      </Section>

      <Section title="Association weeks for sale">
        <Area label="Intro" value={f.hoaSalesIntro} onChange={set("hoaSalesIntro")} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Text label="Contact" value={f.hoaSalesContactName} onChange={set("hoaSalesContactName")} />
          <Text label="Phone" value={f.hoaSalesContactPhone} onChange={set("hoaSalesContactPhone")} />
          <Text label="Email" value={f.hoaSalesContactEmail} onChange={set("hoaSalesContactEmail")} />
        </div>
      </Section>

      <Section title="Comment card & regime managers" hint="Comment cards are emailed to the routing address below.">
        <Area label="Intro" value={f.commentCardIntro} onChange={set("commentCardIntro")} />
        <Area
          label="Managers"
          hint="One per line: Name <email@example.com>"
          value={f.regimeManagers}
          onChange={set("regimeManagers")}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Text label="Phone" value={f.regimePhone} onChange={set("regimePhone")} />
          <Text label="Fax" value={f.regimeFax} onChange={set("regimeFax")} />
          <Text label="Routing email" value={f.regimeEmail} onChange={set("regimeEmail")} />
        </div>
      </Section>

      <Section title="Hurricane & weather links">
        <Area label="Intro" value={f.weatherIntro} onChange={set("weatherIntro")} />
        <Area
          label="Links"
          hint="One per line: Label | https://url"
          value={f.weatherLinks}
          onChange={set("weatherLinks")}
        />
      </Section>

      <Section title="Internal trades" hint="Shown on the trade listing form.">
        <Area label="Trade fee note" value={f.tradeFeeNote} onChange={set("tradeFeeNote")} />
      </Section>

      <button
        onClick={() => void submit()}
        disabled={busy}
        className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save portal settings"}
      </button>
    </div>
  );
}

// ── Small shared inputs ────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl p-5">
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}
      <div className="space-y-3 mt-4">{children}</div>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
