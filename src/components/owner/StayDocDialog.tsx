import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  X,
  Download,
  MapPin,
  Navigation,
  Phone,
  CalendarDays,
  Search,
  Star,
  FileText,
} from "lucide-react";
import { resortTheme } from "@/components/owner/portalTheme";
import {
  findWeekForDate,
  formatWeekRange,
  getCalendarYears,
  getWeeksForYear,
} from "@/lib/weekCalendar";

/**
 * The "Arriving and staying" documents, opened rather than downloaded.
 *
 * Scott, 2026-09-15: "It would be nice if we made this section more 2026
 * rather than 1980." Three viewers, chosen per document by the `viewer` field
 * so The Club Group can change the copy without a deploy:
 *
 *   calendar   — year / week / date picker over the official resort calendar
 *   directions — the drive as steps, plus Google Maps and Waze buttons
 *   content    — the document's text, formatted for reading on a phone
 *
 * The PDF stays available as a takeaway unless `hideDownload` is set. Nothing
 * here invents content: bodies are the resorts' own wording, seeded from their
 * PDFs (see convex/stayViewerSeed.ts).
 */

export type StayDoc = {
  _id: string;
  title: string;
  url?: string | null;
  viewer?: "content" | "calendar" | "directions" | null;
  body?: string | null;
  hideDownload?: boolean | null;
};

/** Sea Pines destinations an arriving owner actually needs. */
const DESTINATIONS: Record<
  string,
  { label: string; hint: string; query: string; lat?: number; lng?: number }[]
> = {
  spicebush: [
    {
      label: "Sea Pines Welcome Center",
      hint: "Pick up your gate pass here first",
      query: "Sea Pines Welcome Center, Hilton Head Island, SC",
    },
    {
      label: "Spicebush at Sea Pines",
      hint: "Your villa",
      query: "Spicebush at Sea Pines, Hilton Head Island, SC",
      lat: 32.125879,
      lng: -80.792846,
    },
    {
      label: "Harbour Town Yacht Club",
      hint: "149 Lighthouse Road — welcome packets",
      query: "149 Lighthouse Road, Hilton Head Island, SC 29928",
    },
  ],
  swallowtail: [
    {
      label: "Sea Pines Welcome Center",
      hint: "Pick up your gate pass here first",
      query: "Sea Pines Welcome Center, Hilton Head Island, SC",
    },
    {
      label: "Swallowtail at Sea Pines",
      hint: "Your villa",
      query: "Swallowtail at Sea Pines, Hilton Head Island, SC",
      lat: 32.132637,
      lng: -80.801083,
    },
    {
      label: "Harbour Town Yacht Club",
      hint: "149 Lighthouse Road — welcome packets",
      query: "149 Lighthouse Road, Hilton Head Island, SC 29928",
    },
  ],
};

function mapsUrl(d: { query: string; lat?: number; lng?: number }) {
  const q = d.lat != null ? `${d.lat},${d.lng}` : d.query;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

function wazeUrl(d: { query: string; lat?: number; lng?: number }) {
  return d.lat != null
    ? `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(d.query)}&navigate=yes`;
}

const paragraphs = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** "Charter Fishing — 671-4534" opens an activity; plain text does not. */
const ACTIVITY = /^(.+?)\s*[—–-]\s*((?:\d{3}[-.])?\d{3}[-.]\d{4})$/;

function telHref(printed: string) {
  const digits = printed.replace(/\D/g, "");
  // Numbers are stored with the 843 area code [scott, 2026-09-15]. The
  // 7-digit fallback stays for anything an admin types the old way.
  return `tel:+1${digits.length === 7 ? "843" : ""}${digits}`;
}

function ContentViewer({ body }: { body: string }) {
  return (
    <div className="space-y-4">
      {paragraphs(body).map((para, i) => {
        const [first, ...rest] = para.split("\n");
        const m = first.match(ACTIVITY);
        if (m) {
          return (
            <div
              key={i}
              className="rounded-xl border bg-white p-4 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm">{m[1]}</p>
                {rest.length > 0 && (
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                    {rest.join(" ")}
                  </p>
                )}
              </div>
              <a
                href={telHref(m[2])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                {m[2]}
              </a>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-line">
            {para}
          </p>
        );
      })}
    </div>
  );
}

function DirectionsViewer({
  body,
  siteSlug,
  accent,
}: {
  body: string;
  siteSlug: string;
  accent: string;
}) {
  const steps = paragraphs(body);
  const destinations = DESTINATIONS[siteSlug] ?? DESTINATIONS.spicebush;
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        {destinations.map((d) => (
          <div
            key={d.label}
            className="rounded-xl border bg-white p-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <MapPin
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: accent }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.hint}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={mapsUrl(d)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: accent }}
              >
                <Navigation className="w-3.5 h-3.5" />
                Google Maps
              </a>
              <a
                href={wazeUrl(d)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted/50"
              >
                <Navigation className="w-3.5 h-3.5" />
                Waze
              </a>
            </div>
          </div>
        ))}
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed pt-0.5">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CalendarViewer({
  intro,
  accent,
  accentSoft,
}: {
  intro?: string | null;
  accent: string;
  accentSoft: string;
}) {
  const years = useMemo(() => getCalendarYears(), []);
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = useMemo(() => findWeekForDate(today), [today]);
  const [year, setYear] = useState(
    thisWeek?.year ?? years[0] ?? new Date().getFullYear(),
  );
  const [lookup, setLookup] = useState("");

  const owned = useQuery(api.owner.listOwnedWeeks);
  const ownedNumbers = useMemo(
    () => new Set((owned ?? []).map((w: any) => w.weekNumber)),
    [owned],
  );

  const weeks = useMemo(() => getWeeksForYear(year), [year]);
  const found = lookup ? findWeekForDate(lookup) : null;

  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-5">
      {intro && (
        <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>
      )}

      <div className="rounded-xl border bg-white p-3.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Search className="w-3.5 h-3.5" />
          Which week is a date in?
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
          />
          {lookup && (
            <p className="text-sm">
              {found ? (
                <>
                  <span className="font-semibold">Week {found.weekNumber}</span>
                  {", "}
                  {found.year} — {formatWeekRange(found.weekNumber, found.year)}
                </>
              ) : (
                <span className="text-muted-foreground">
                  That date is outside the published calendar.
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
            style={
              y === year
                ? { backgroundColor: accent, borderColor: accent, color: "#fff" }
                : undefined
            }
          >
            {y}
          </button>
        ))}
      </div>

      {ownedNumbers.size > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="w-3.5 h-3.5" style={{ color: accent }} />
          Highlighted weeks are ones you own.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {weeks.map((w) => {
          const isOwned = ownedNumbers.has(w.weekNumber);
          const isNow =
            thisWeek?.weekNumber === w.weekNumber && thisWeek?.year === w.year;
          return (
            <div
              key={`${w.year}-${w.weekNumber}`}
              className="rounded-lg border px-3 py-2"
              style={
                isOwned
                  ? { backgroundColor: accentSoft, borderColor: accent }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold">Week {w.weekNumber}</p>
                {isOwned && (
                  <Star
                    className="w-3 h-3 shrink-0"
                    style={{ color: accent }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmt(w.startDate)} – {fmt(w.endDate)}
              </p>
              {isNow && (
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide mt-0.5"
                  style={{ color: accent }}
                >
                  This week
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StayDocDialog({
  doc,
  siteSlug,
  onClose,
}: {
  doc: StayDoc | null;
  siteSlug: string;
  onClose: () => void;
}) {
  const theme = resortTheme(siteSlug);
  if (!doc) return null;

  const body = doc.body ?? "";
  const showDownload = !doc.hideDownload && !!doc.url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#faf8f5] shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4 rounded-t-2xl"
          style={{ backgroundColor: theme.ink }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {doc.viewer === "calendar" ? (
              <CalendarDays className="w-5 h-5 text-white/80 shrink-0" />
            ) : doc.viewer === "directions" ? (
              <Navigation className="w-5 h-5 text-white/80 shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-white/80 shrink-0" />
            )}
            <h2 className="text-base font-bold text-white truncate">
              {doc.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/70 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {doc.viewer === "calendar" ? (
            <CalendarViewer
              intro={doc.body}
              accent={theme.accent}
              accentSoft={theme.accentSoft}
            />
          ) : doc.viewer === "directions" ? (
            <DirectionsViewer
              body={body}
              siteSlug={siteSlug}
              accent={theme.accent}
            />
          ) : body ? (
            <ContentViewer body={body} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This document is available as a download.
            </p>
          )}
        </div>

        {showDownload && (
          <div className="px-5 pb-5 flex justify-end">
            <a
              href={doc.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white text-sm font-semibold hover:bg-muted/50"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
