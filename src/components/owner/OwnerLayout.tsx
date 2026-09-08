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
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useRef } from "react";
import { useSiteBrand, useSitePayment } from "@/lib/siteContext";

const navItems = [
  { label: "Dashboard", path: "/owner", icon: LayoutDashboard },
  { label: "My Weeks", path: "/owner/properties", icon: HomeIcon },
  // Joint Swallowtail + Spicebush pool — same listings from either portal.
  { label: "Marketplace", path: "/owner/marketplace", icon: Store },
  { label: "My Listings", path: "/owner/listings", icon: Tag },
  { label: "Inquiries", path: "/owner/inquiries", icon: MessageSquare },
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
  const nav = payment.enabled ? [...navItems, paymentNavItem] : navItems;
  const currentUser = useQuery(api.owner.currentUser);
  const claimProfile = useMutation(api.owner.claimProfile);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const claimedRef = useRef(false);

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
            to="/owner/login"
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
    navigate("/owner/login");
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
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
          w-64 bg-foreground text-primary-foreground flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <Link to="/owner" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Key className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold">{brand.wordmarkTop}</div>
              <div className="text-[10px] text-primary-foreground/50 uppercase tracking-wider">
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

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ label, path, icon: Icon }) => {
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
                      ? "bg-primary text-primary-foreground"
                      : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/5"
                  }
                `}
              >
                <Icon className="w-4.5 h-4.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
            Back to Site
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-foreground/60 hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-background border-b flex items-center px-4 lg:px-6 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground">
            {currentUser.displayName ?? currentUser.email ?? "Owner"}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
