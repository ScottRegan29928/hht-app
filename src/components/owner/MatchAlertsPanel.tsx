import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import { Search, Repeat, X, Mail, Phone, BellOff } from "lucide-react";
import type { ResortTheme } from "./portalTheme";
import { KIND_STYLES, COMMUNITY_LABELS } from "./portalTheme";

/**
 * The bell panel: "someone wants a week you own".
 *
 * Opening the panel marks everything read, because the owner has now seen it —
 * but dismissing is separate and explicit, so an alert stays in the list until
 * the owner clears it. Contact details are shown inline: the whole point is to
 * let two owners reach each other, and making them click through to the
 * marketplace to find the same row again is friction for no gain.
 */
export function MatchAlertsPanel({
  theme,
  onClose,
}: {
  theme: ResortTheme;
  onClose: () => void;
}) {
  const matches = useQuery(api.marketplaceMatches.myMatches, {});
  const markRead = useMutation(api.marketplaceMatches.markRead);
  const dismiss = useMutation(api.marketplaceMatches.dismiss);
  const ref = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  // Mark read once, after the list actually arrives.
  useEffect(() => {
    if (matches && matches.length > 0 && !markedRef.current) {
      markedRef.current = true;
      void markRead({});
    }
  }, [matches, markRead]);

  // Close on outside click and on Escape — a dropdown that traps you is worse
  // than no dropdown.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Marketplace alerts"
      className="absolute right-0 top-11 z-50 w-[min(92vw,400px)] rounded-2xl bg-white border border-slate-200 overflow-hidden"
      style={{ boxShadow: "0 18px 44px -16px rgba(12,40,52,0.34)" }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between text-white"
        style={{
          backgroundImage: `linear-gradient(100deg, ${theme.inkDeep}, ${theme.ink})`,
          boxShadow: `inset 0 -3px 0 0 ${theme.accent}`,
        }}
      >
        <div>
          <div className="text-sm font-semibold">Marketplace alerts</div>
          <div className="text-[11px] text-white/70">
            When someone wants a week you own
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close alerts"
          className="text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
        {matches === undefined ? (
          <div className="p-6 text-center text-sm text-slate-400 animate-pulse">
            Loading…
          </div>
        ) : matches.length === 0 ? (
          <div className="p-7 text-center">
            <BellOff className="w-7 h-7 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">
              No alerts right now
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              If another owner posts that they want to buy or trade for a week
              you own, it will appear here and we will email you.
            </p>
          </div>
        ) : (
          matches.map((m: any) => {
            const style = KIND_STYLES[m.kind] ?? KIND_STYLES.want_to_buy;
            const Icon = m.kind === "trade" ? Repeat : Search;
            const l = m.listing;
            return (
              <div key={m._id} className="p-4 hover:bg-slate-50/70">
                <div className="flex items-start gap-3">
                  <span
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${style.chip}`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 leading-snug">
                      <strong>
                        {m.kind === "trade"
                          ? "Someone wants to trade for"
                          : "Someone wants to buy"}{" "}
                        week {m.weekNumber}
                      </strong>
                      {m.unitNumber ? (
                        <span className="text-slate-500">
                          {" "}
                          — the week you own at {m.unitNumber}
                        </span>
                      ) : null}
                    </p>

                    {m.kind === "trade" && l.weekLabel && (
                      <p className="text-xs text-slate-500 mt-1">
                        They own week {l.weekLabel}
                        {l.unitNumber ? ` in unit ${l.unitNumber}` : ""}
                        {l.communitySlug
                          ? ` at ${COMMUNITY_LABELS[l.communitySlug] ?? l.communitySlug}`
                          : ""}
                      </p>
                    )}
                    {l.notes && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {l.notes}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                      {l.contactName && (
                        <span className="font-medium text-slate-700">
                          {l.contactName}
                        </span>
                      )}
                      {l.contactPhone && (
                        <a
                          href={`tel:${l.contactPhone.replace(/[^\d+]/g, "")}`}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
                        >
                          <Phone className="w-3 h-3" />
                          {l.contactPhone}
                        </a>
                      )}
                      {l.contactEmail && (
                        <a
                          href={`mailto:${l.contactEmail}`}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 break-all"
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          {l.contactEmail}
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => void dismiss({ matchId: m._id })}
                      className="mt-2 text-[11px] text-slate-400 hover:text-slate-700 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Link
        to="/owner/marketplace"
        onClick={onClose}
        className="block px-4 py-3 text-center text-sm font-medium border-t border-slate-100 hover:bg-slate-50"
        style={{ color: theme.accentInk }}
      >
        Open the marketplace
      </Link>
    </div>
  );
}
