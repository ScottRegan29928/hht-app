import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  LayoutDashboard,
  Home as HomeIcon,
  MessageSquare,
  Store,
  Tag,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Key,
  CreditCard,
  FileText,
  Users,
  Info,
  MessageSquarePlus,
  Vote,
  Bell,
  Sparkles,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useRef } from "react";
import { useSiteBrand, useSitePayment, useSiteFlags } from "@/lib/siteContext";
import { resortTheme, themeVars } from "./portalTheme";
import { MatchAlertsPanel } from "./MatchAlertsPanel";

// Grouped so the portal reads as three jobs — your ownership, the resale
// marketplace, and the association — instead of one flat list of nine links.
const navGroups: {
  heading?: string;
  items: { label: string; path: string; icon: any }[];
}[] = [
  {
    items: [
      { label: "Dashboard", path: "/owner", icon: LayoutDashboard },
      { label: "My Weeks", path: "/owner/properties", icon: HomeIcon },
    ],
  },
  {
    heading: "Buy, sell & trade",
    items: [
      // Joint Swallowtail + Spicebush pool — same listings from either portal.
      { label: "Marketplace", path: "/owner/marketplace", icon: Store },
      { label: "My Listings", path: "/owner/listings", icon: Tag },
      { label: "Inquiries", path: "/owner/inquiries", icon: MessageSquare },
    ],
  },
  {
    heading: "Your association",
    items: [
      { label: "Documents", path: "/owner/documents", icon: FileText },
      { label: "Board", path: "/owner/board", icon: Users },
      { label: "Resort Info", path: "/owner/resort", icon: Info },
      { label: "Comment Card", path: "/owner/comment-card", icon: MessageSquarePlus },
    ],
  },
];

// Shown only where the resort actually takes payments — Swallowtail links out,
// Spicebush uses Square, a resort with neither should not see the item at all.
const paymentNavItem = {
  label: "Make a Payment",
  path: "/owner/payment",
  icon: CreditCard,
};

export function OwnerLayout() {
  const brand = useSiteBrand();
  const payment = useSitePayment();
  const { siteSlug } = useSiteFlags();
  const theme = resortTheme(siteSlug);
  const groups = payment.enabled
    ? [...navGroups, { items: [paymentNavItem] }]
    : navGroups;
  const currentUser = useQuery(api.owner.currentUser);
  // Seasonal association-voting banner, managed in /management/owner-portal.
  // Skipped until the owner is resolved: ownerPortal.getSettings is gated and
  // throws for anonymous callers, which surfaced as a console error on the
  // signed-out /owner/* routes.
  const portal = useQuery(
    api.ownerPortal.getSettings,
    currentUser ? { siteSlug } : "skip"
  );
  const claimProfile = useMutation(api.owner.claimProfile);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const claimedRef = useRef(false);
  // Match alerts: someone wants a week this owner holds [scott, 2026-09-12].
  const unread = useQuery(
    api.marketplaceMatches.unreadCount,
    currentUser ? {} : "skip"
  );

  // Auto-link profile when needsLink is true (new signup matching existing owner email)
  useEffect(() => {
    if (currentUser?.needsLink && !claimedRef.current) {
      claimedRef.current = true;
      claimProfile({ profileId: currentUser._id }).catch(() => {
        claimedRef.current = false;
      });
    }
  }, [currentUser, claimProfile]);

  // Loading
  if (currentUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Not logged in or not owner → redirect to login (which clears any stale session)
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="bg-background rounded-2xl shadow-lg border p-8 max-w-md w-full mx-4 text-center">
          <Key className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Owner Portal</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in with your owner account to continue.
          </p>
          <Link
            to="/ownerlogin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
          <p className="text-xs text-muted-foreground mt-4">
            If you were using the admin portal, you'll need to sign in separately here.
          </p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/ownerlogin");
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ ...themeVars(theme), background: "#F4F6F7" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 text-white flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{
          backgroundImage: `linear-gradient(175deg, ${theme.ink} 0%, ${theme.inkDeep} 100%)`,
        }}
      >
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <Link to="/owner" className="flex items-center gap-3">
            {brand.logo?.white ? (
              <img
                src={brand.logo.white}
                alt=""
                className="h-9 w-auto object-contain"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: theme.accent }}
              >
                <Key className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <div className="text-sm font-bold">{brand.wordmarkTop}</div>
              <div
                className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: theme.accent }}
              >
                Owner Portal
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-primary-foreground/60 hover:text-primary-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={group.heading ?? `group-${gi}`} className="space-y-1">
              {group.heading && (
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {group.heading}
                </div>
              )}
              {group.items.map(({ label, path, icon: Icon }) => {
                const isActive =
                  path === "/owner"
                    ? location.pathname === "/owner"
                    : location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "text-white shadow-sm"
                          : "text-white/65 hover:text-white hover:bg-white/5"
                      }
                    `}
                    style={
                      isActive
                        ? {
                            background: theme.accent,
                            // A left rule keeps the active item legible for
                            // anyone who cannot separate the two colors.
                            boxShadow: `inset 3px 0 0 0 rgba(255,255,255,0.65)`,
                          }
                        : undefined
                    }
                  >
                    <Icon className="w-4.5 h-4.5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/65 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
            Back to Site
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/65 hover:text-red-300 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-1.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />

          {/* Match alerts */}
          <div className="relative">
            <button
              onClick={() => setAlertsOpen((v) => !v)}
              aria-label={
                unread ? `${unread} new marketplace alerts` : "Marketplace alerts"
              }
              aria-expanded={alertsOpen}
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" />
              {!!unread && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white"
                  style={{ background: theme.accent }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {alertsOpen && (
              <MatchAlertsPanel
                theme={theme}
                onClose={() => setAlertsOpen(false)}
              />
            )}
          </div>

          <div className="flex items-center gap-2.5 pl-1">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
              style={{ background: theme.ink }}
            >
              {(currentUser.displayName ?? currentUser.email ?? "O")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </span>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {currentUser.displayName ?? currentUser.email ?? "Owner"}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {portal?.votingEnabled && portal.votingUrl && (
            <a
              href={portal.votingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl text-white hover:brightness-110 transition-all shadow-sm"
              style={{
                backgroundImage: `linear-gradient(100deg, ${theme.inkDeep} 0%, ${theme.ink} 100%)`,
                boxShadow: `inset 4px 0 0 0 ${theme.accent}`,
              }}
            >
              <Vote className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">
                {portal.votingLabel ?? "Association voting is open"}
              </span>
              <span className="ml-auto text-sm underline">Cast your vote</span>
            </a>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
