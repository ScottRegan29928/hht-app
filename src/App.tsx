import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { HomePage } from "./pages/HomePage";
import { ErrorBoundary } from "./components/ErrorBoundary";
// PropertyDetailPage removed — all week actions are inline on PropertiesPage

// Perf [2026-10-15]: every route except the home page is code-split so the
// first paint only downloads what "/" needs (main bundle was 850 KB gz).
const CommunityPage = lazy(() => import("./pages/CommunityPage").then((m) => ({ default: m.CommunityPage })));
const PropertyPage = lazy(() => import("./pages/PropertyPage").then((m) => ({ default: m.PropertyPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((m) => ({ default: m.SearchPage })));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import("./pages/admin/LoginPage").then((m) => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import("./pages/admin/DashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminPropertiesPage = lazy(() => import("./pages/admin/PropertiesPage").then((m) => ({ default: m.AdminPropertiesPage })));
const PropertyEditPage = lazy(() => import("./pages/admin/PropertyEditPage").then((m) => ({ default: m.PropertyEditPage })));
const AdminCommunitiesPage = lazy(() => import("./pages/admin/CommunitiesPage").then((m) => ({ default: m.AdminCommunitiesPage })));
const AdminAmenitiesPage = lazy(() => import("./pages/admin/AmenitiesPage").then((m) => ({ default: m.AdminAmenitiesPage })));
const AdminPaymentsPage = lazy(() => import("./pages/admin/PaymentsPage").then((m) => ({ default: m.AdminPaymentsPage })));
const AdminWeeksPage = lazy(() => import("./pages/admin/WeeksPage").then((m) => ({ default: m.AdminWeeksPage })));
const AdminSaleRequestsPage = lazy(() => import("@/pages/admin/SaleRequestsPage").then((m) => ({ default: m.AdminSaleRequestsPage })));
const AdminInquiriesPage = lazy(() => import("./pages/admin/InquiriesPage").then((m) => ({ default: m.AdminInquiriesPage })));
const OwnerLayout = lazy(() => import("./components/owner/OwnerLayout").then((m) => ({ default: m.OwnerLayout })));
const OwnerLoginPage = lazy(() => import("./pages/owner/LoginPage").then((m) => ({ default: m.OwnerLoginPage })));
const OwnerDashboardPage = lazy(() => import("./pages/owner/DashboardPage").then((m) => ({ default: m.OwnerDashboardPage })));
const OwnerPropertiesPage = lazy(() => import("./pages/owner/PropertiesPage").then((m) => ({ default: m.OwnerPropertiesPage })));
const OwnerInquiriesPage = lazy(() => import("./pages/owner/InquiriesPage").then((m) => ({ default: m.OwnerInquiriesPage })));
const OwnerMarketplacePage = lazy(() => import("./pages/owner/MarketplacePage").then((m) => ({ default: m.OwnerMarketplacePage })));
const OwnerMyListingsPage = lazy(() => import("./pages/owner/MyListingsPage").then((m) => ({ default: m.OwnerMyListingsPage })));
const OwnerPaymentPage = lazy(() => import("./pages/owner/PaymentPage").then((m) => ({ default: m.OwnerPaymentPage })));
const OwnerDocumentsPage = lazy(() => import("./pages/owner/DocumentsPage").then((m) => ({ default: m.OwnerDocumentsPage })));
const OwnerBoardPage = lazy(() => import("./pages/owner/BoardPage").then((m) => ({ default: m.OwnerBoardPage })));
const OwnerResortInfoPage = lazy(() => import("./pages/owner/ResortInfoPage").then((m) => ({ default: m.OwnerResortInfoPage })));
const OwnerCommentCardPage = lazy(() => import("./pages/owner/CommentCardPage").then((m) => ({ default: m.OwnerCommentCardPage })));
const OwnerMaintenancePage = lazy(() => import("./pages/owner/MaintenancePage").then((m) => ({ default: m.OwnerMaintenancePage })));
const OwnerAccountPage = lazy(() => import("./pages/owner/AccountPage").then((m) => ({ default: m.OwnerAccountPage })));
const OwnerActivatePage = lazy(() => import("./pages/owner/ActivatePage").then((m) => ({ default: m.OwnerActivatePage })));
const AccountPage = lazy(() => import("./pages/admin/AccountPage").then((m) => ({ default: m.AccountPage })));
const OwnersPage = lazy(() => import("./pages/admin/OwnersPage").then((m) => ({ default: m.OwnersPage })));
const OwnerDetailPage = lazy(() => import("./pages/admin/OwnerDetailPage").then((m) => ({ default: m.OwnerDetailPage })));
const UsersPage = lazy(() => import("./pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((m) => ({ default: m.CheckoutPage })));
const ResourcesRoute = lazy(() => import("./pages/ResourcesPage"));
const ThingsToDoRoute = lazy(() => import("./pages/ThingsToDoPage"));
const OwnRoute = lazy(() => import("./pages/OwnPage"));
const SlugRoute = lazy(() => import("./pages/SeoLandingPage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage").then((m) => ({ default: m.BlogIndexPage })));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage").then((m) => ({ default: m.BlogPostPage })));
const AdminPagesPage = lazy(() => import("./pages/admin/PagesPage").then((m) => ({ default: m.AdminPagesPage })));
const AdminPageEditPage = lazy(() => import("./pages/admin/PageEditPage").then((m) => ({ default: m.AdminPageEditPage })));
const AdminBlogPage = lazy(() => import("./pages/admin/BlogPage").then((m) => ({ default: m.AdminBlogPage })));
const AdminBlogEditPage = lazy(() => import("./pages/admin/BlogEditPage").then((m) => ({ default: m.AdminBlogEditPage })));
const AdminSeoPage = lazy(() => import("./pages/admin/SeoPage").then((m) => ({ default: m.AdminSeoPage })));
const AdminStorePage = lazy(() => import("./pages/admin/StorePage").then((m) => ({ default: m.AdminStorePage })));
const AdminOwnerPortalPage = lazy(() => import("./pages/admin/OwnerPortalPage").then((m) => ({ default: m.AdminOwnerPortalPage })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  // /adminlogin must be in the admin branch too, or it renders inside the
  // public site shell instead of the login card [scott, 2026-09-10].
  const isAdmin =
    location.pathname.startsWith("/management") ||
    location.pathname === "/adminlogin";
  // Covers /owner/*, /ownerlogin and /owneractivate — all of which must render
  // in the portal shell, not the public site shell.
  const isOwner = location.pathname.startsWith("/owner");

  if (isAdmin) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={null}>
        <Routes>
          {/* Admin sign-in lives at /adminlogin [scott, 2026-09-10]; the old
              path is kept as a redirect so saved links keep working. */}
          <Route path="/adminlogin" element={<AdminLoginPage />} />
          <Route
            path="/management/login"
            element={<Navigate to="/adminlogin" replace />}
          />
          <Route path="/management" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="properties" element={<AdminPropertiesPage />} />
            <Route path="properties/:id" element={<PropertyEditPage />} />
            <Route path="communities" element={<AdminCommunitiesPage />} />
            <Route path="amenities" element={<AdminAmenitiesPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="weeks" element={<AdminWeeksPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
            <Route path="sale-requests" element={<AdminSaleRequestsPage />} />
            <Route path="owners" element={<OwnersPage />} />
            <Route path="owners/:ownerId" element={<OwnerDetailPage />} />
            <Route path="pages" element={<AdminPagesPage />} />
            <Route path="pages/new" element={<AdminPageEditPage />} />
            <Route path="pages/:id" element={<AdminPageEditPage />} />
            <Route path="blog" element={<AdminBlogPage />} />
            <Route path="blog/new" element={<AdminBlogEditPage />} />
            <Route path="blog/:id" element={<AdminBlogEditPage />} />
            <Route path="seo" element={<AdminSeoPage />} />
            <Route path="store" element={<AdminStorePage />} />
            <Route path="owner-portal" element={<AdminOwnerPortalPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Routes>
        </Suspense>
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  if (isOwner) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={null}>
        <Routes>
          {/* Owner sign-in lives at /ownerlogin [scott, 2026-09-11], matching
              /adminlogin. The old path stays as a redirect so links already in
              owners' bookmarks and inboxes keep working. */}
          <Route path="/ownerlogin" element={<OwnerLoginPage />} />
          <Route
            path="/owner/login"
            element={<Navigate to="/ownerlogin" replace />}
          />
          <Route path="/owner/activate" element={<OwnerActivatePage />} />
          <Route path="/owneractivate" element={<OwnerActivatePage />} />
          <Route path="/owner" element={<OwnerLayout />}>
            <Route index element={<OwnerDashboardPage />} />
            <Route path="properties" element={<OwnerPropertiesPage />} />
            {/* PropertyDetailPage removed — inline on PropertiesPage */}
            <Route path="inquiries" element={<OwnerInquiriesPage />} />
            <Route path="marketplace" element={<OwnerMarketplacePage />} />
            <Route path="listings" element={<OwnerMyListingsPage />} />
            <Route path="payment" element={<OwnerPaymentPage />} />
            <Route path="documents" element={<OwnerDocumentsPage />} />
            <Route path="board" element={<OwnerBoardPage />} />
            <Route path="resort" element={<OwnerResortInfoPage />} />
            <Route path="comment-card" element={<OwnerCommentCardPage />} />
            <Route path="maintenance" element={<OwnerMaintenancePage />} />
            <Route path="account" element={<OwnerAccountPage />} />
          </Route>
        </Routes>
        </Suspense>
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/community/:slug" element={<CommunityPage />} />
          <Route
            path="/property/:slug"
            element={
              <ErrorBoundary>
                <PropertyPage />
              </ErrorBoundary>
            }
          />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/articles" element={<BlogIndexPage />} />
          <Route path="/articles/:slug" element={<BlogPostPage />} />
          {/* Spicebush Resource Guides; other sites fall through to ContentPage. */}
          <Route path="/resources" element={<ResourcesRoute />} />
          {/* Spicebush Things to Do; other sites fall through to ContentPage. */}
          <Route path="/things-to-do" element={<ThingsToDoRoute />} />
          <Route path="/own-at-spicebush" element={<OwnRoute />} />
          <Route path="/own-at-swallowtail" element={<OwnRoute />} />
          {/* Catch-all for admin-authored content pages. MUST stay last —
              it shadows any route declared after it, and it also serves
              as the site's 404. Code-routed SEO landing pages
              (convex/seoLandingData.ts) resolve here first. */}
          <Route path="/:slug" element={<SlugRoute />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
