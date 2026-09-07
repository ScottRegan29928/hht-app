import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  LayoutDashboard,
  Home as HomeIcon,
  Building2,
  Calendar,
  MessageSquare,
  Users,
  Shield,
  LogOut,
  ExternalLink,
  Menu,
  X,
  User,
  Settings,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", path: "/management", icon: LayoutDashboard },
  { label: "Properties", path: "/management/properties", icon: HomeIcon },
  { label: "Communities", path: "/management/communities", icon: Building2 },
  { label: "Weeks", path: "/management/weeks", icon: Calendar },
  { label: "Owners", path: "/management/owners", icon: Users },
  { label: "Inquiries", path: "/management/inquiries", icon: MessageSquare },
];

export function AdminLayout() {
  const currentUser = useQuery(api.admin.currentUser);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cachedUser, setCachedUser] = useState<typeof currentUser>(undefined);

  // Cache the user so we don't flash the loading state on page navigation
  if (currentUser !== undefined && currentUser !== cachedUser) {
    setCachedUser(currentUser);
  }

  const user = currentUser ?? cachedUser;

  // Loading — only show on first load, not during navigation
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Not logged in or not admin → redirect to login
  const adminRoles = ["admin", "admin_user", "admin_rental", "admin_sales"];
  if (!user || !user.profile || !adminRoles.includes(user.profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="bg-background rounded-2xl shadow-lg border p-8 max-w-md w-full mx-4 text-center">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground mb-6">
            {!user
              ? "Please sign in to access the admin portal."
              : "Your account does not have admin privileges."}
          </p>
          <Link
            to="/management/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const isSuperUser = user.isSuperUser;
  const displayName =
    user.profile.displayName ?? user.profile.email ?? "Admin";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
    navigate("/management/login");
  };

  // Build nav items — add Users page for super admins
  const allNavItems = isSuperUser
    ? [...navItems, { label: "Admin Users", path: "/management/users", icon: Shield }]
    : navItems;

  return (
    <div className="h-screen bg-muted/30 flex overflow-hidden">
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
          <Link to="/management" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold">HHT Admin</div>
              <div className="text-[10px] text-primary-foreground/50 uppercase tracking-wider">
                Management Portal
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

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allNavItems.map(({ label, path, icon: Icon }) => {
            const isActive =
              path === "/management"
                ? location.pathname === "/management"
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

        {/* Bottom: user info + sign out */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {/* User account card */}
          <Link
            to="/management/account"
            onClick={() => setSidebarOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
              ${
                location.pathname === "/management/account"
                  ? "bg-primary text-primary-foreground"
                  : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/5"
              }
            `}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-white/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-[10px] opacity-50">
                {isSuperUser ? "Super User" : "User"}
              </div>
            </div>
            <Settings className="w-4 h-4 opacity-40" />
          </Link>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-4.5 h-4.5" />
            View Public Site
          </a>
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
        {/* Top bar */}
        <header className="h-14 bg-background border-b flex items-center px-4 lg:px-6 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link
            to="/management/account"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                {initials}
              </div>
            )}
            {displayName}
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
