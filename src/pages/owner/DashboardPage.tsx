import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import {
  Calendar,
  MessageSquare,
  Clock,
  ArrowRight,
  Tag,
  FileText,
  Users,
  Info,
  MessageSquarePlus,
  Store,
  BellRing,
} from "lucide-react";
import { useSiteFlags } from "@/lib/siteContext";
import { resortTheme } from "@/components/owner/portalTheme";

export function OwnerDashboardPage() {
  const stats = useQuery(api.owner.dashboardStats);
  const requests = useQuery(api.owner.listSaleRequests);
  const { siteSlug, siteName } = useSiteFlags();
  const portal = useQuery(api.ownerPortal.overview, { siteSlug });
  const theme = resortTheme(siteSlug);
  const matches = useQuery(api.marketplaceMatches.myMatches, {});

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">
          Loading dashboard…
        </div>
      </div>
    );
  }

  const recentRequests = requests?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      {/* A branded welcome band: the dashboard opened on plain white text and
          read like a settings screen rather than somewhere pleasant to be. */}
      <div
        className="rounded-2xl px-6 py-7 text-white relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(105deg, ${theme.inkDeep} 0%, ${theme.ink} 100%)`,
          boxShadow: `inset 4px 0 0 0 ${theme.accent}`,
        }}
      >
        {/* A soft wash of the resort accent, rather than blending teal into
            berry — that mid-tone came out muddy brown. */}
        <div
          className="absolute -right-20 -top-24 w-72 h-72 rounded-full opacity-25 blur-2xl"
          style={{ background: theme.accent }}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-bold relative">
          {portal?.viewerName
            ? `Welcome back, ${portal.viewerName}`
            : "Owner Portal"}
        </h1>
        <p className="text-sm text-white/75 mt-1 relative">
          Your ownership at {siteName}, all in one place.
        </p>
      </div>

      {/* Match alerts get top billing — they are time-sensitive and the whole
          reason the email was sent. */}
      {!!matches?.length && (
        <Link
          to="/owner/marketplace"
          className="flex items-start gap-3 rounded-xl border p-4 transition-colors hover:brightness-[0.98]"
          style={{
            background: theme.accentSoft,
            borderColor: theme.accent + "44",
          }}
        >
          <BellRing
            className="w-5 h-5 shrink-0 mt-0.5"
            style={{ color: theme.accentInk }}
          />
          <div className="min-w-0">
            <p
              className="text-sm font-semibold"
              style={{ color: theme.accentInk }}
            >
              {matches.length === 1
                ? "Another owner wants a week you own"
                : `${matches.length} owners want weeks you own`}
            </p>
            <p className="text-xs mt-0.5 text-slate-600">
              {matches
                .slice(0, 2)
                .map((m: any) =>
                  m.kind === "trade"
                    ? `Trade for week ${m.weekNumber}`
                    : `Wants to buy week ${m.weekNumber}`
                )
                .join(" · ")}
              {matches.length > 2 ? ` · +${matches.length - 2} more` : ""}
            </p>
          </div>
          <ArrowRight
            className="w-4 h-4 ml-auto shrink-0 mt-0.5"
            style={{ color: theme.accentInk }}
          />
        </Link>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Owned Weeks"
          value={stats.ownedWeeks}
          tint="bg-sky-50 text-sky-700 border-sky-100"
        />
        <StatCard
          icon={Tag}
          label="Listed for Sale"
          value={stats.listedForSale}
          tint="bg-emerald-50 text-emerald-700 border-emerald-100"
        />
        <StatCard
          icon={Clock}
          label="Pending Requests"
          value={stats.pendingRequests}
          tint="bg-amber-50 text-amber-700 border-amber-100"
        />
        <StatCard
          icon={MessageSquare}
          label="New Inquiries"
          value={stats.newInquiryCount}
          sublabel={`${stats.inquiryCount} total`}
          tint="bg-violet-50 text-violet-700 border-violet-100"
        />
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/owner/properties"
          className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-[0_8px_22px_-16px_rgba(16,27,46,0.45)] transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">My Weeks</h3>
              <p className="text-sm text-muted-foreground">
                View your weeks and list them for sale
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          to="/owner/inquiries"
          className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-[0_8px_22px_-16px_rgba(16,27,46,0.45)] transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Inquiries</h3>
              <p className="text-sm text-muted-foreground">
                {stats.newInquiryCount > 0
                  ? `${stats.newInquiryCount} new inquiry${stats.newInquiryCount > 1 ? "ies" : ""} to review`
                  : "View and respond to buyer inquiries"}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>

      {/* Association shortcuts — the content that used to be ten accordions */}
      <div>
        <h2 className="font-semibold mb-3">Your association</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <TileLink
            to="/owner/documents"
            icon={FileText}
            title="Documents"
            sub={
              portal?.documentCount
                ? `${portal.documentCount} files`
                : "Deeds, newsletters, minutes"
            }
          />
          <TileLink
            to="/owner/board"
            icon={Users}
            title="Board"
            sub={
              portal?.board?.length
                ? `${portal.board.length} directors`
                : "Your elected directors"
            }
          />
          <TileLink
            to="/owner/resort"
            icon={Info}
            title="Resort Info"
            sub="Check-in, rentals, storms"
          />
          <TileLink
            to="/owner/comment-card"
            icon={MessageSquarePlus}
            title="Comment Card"
            sub="Tell us about your stay"
          />
        </div>
      </div>

      {/* Recent sale requests */}
      {recentRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Recent Sale Requests</h2>
          </div>
          <div className="divide-y">
            {recentRequests.map((r: any) => (
              <div
                key={r._id}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium">
                    {r.propertyAddress}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {" "}
                    — Week {r.weekNumber}
                  </span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Asking ${r.askingPrice.toLocaleString()}
                  </div>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TileLink({
  to,
  icon: Icon,
  title,
  sub,
}: {
  to: string;
  icon: any;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-[0_8px_22px_-16px_rgba(16,27,46,0.45)] transition-all"
    >
      <Icon className="w-4.5 h-4.5 text-slate-400 mb-2.5" />
      <div className="font-medium text-sm text-slate-800">{title}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </Link>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tint,
}: {
  icon: any;
  label: string;
  value: number;
  sublabel?: string;
  /** Tinted chip rather than a saturated block: four solid squares in a row
      competed with the content underneath them. */
  tint: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-[0_1px_2px_rgba(16,27,46,0.05)]">
      <div
        className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${tint}`}
      >
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
      {sublabel && <div className="text-xs text-slate-400">{sublabel}</div>}
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    approved: "Live",
    rejected: "Rejected",
    cancelled: "Withdrawn",
  };
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] ?? styles.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
