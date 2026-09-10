import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { HomePage } from "./pages/HomePage";
import { CommunityPage } from "./pages/CommunityPage";
import { PropertyPage } from "./pages/PropertyPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SearchPage } from "./pages/SearchPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminLoginPage } from "./pages/admin/LoginPage";
import { AdminDashboardPage } from "./pages/admin/DashboardPage";
import { AdminPropertiesPage } from "./pages/admin/PropertiesPage";
import { PropertyEditPage } from "./pages/admin/PropertyEditPage";
import { AdminCommunitiesPage } from "./pages/admin/CommunitiesPage";
import { AdminWeeksPage } from "./pages/admin/WeeksPage";
import { AdminInquiriesPage } from "./pages/admin/InquiriesPage";
import { OwnerLayout } from "./components/owner/OwnerLayout";
import { OwnerLoginPage } from "./pages/owner/LoginPage";
import { OwnerDashboardPage } from "./pages/owner/DashboardPage";
import { OwnerPropertiesPage } from "./pages/owner/PropertiesPage";
// PropertyDetailPage removed — all week actions are inline on PropertiesPage
import { OwnerInquiriesPage } from "./pages/owner/InquiriesPage";
import { OwnerMarketplacePage } from "./pages/owner/MarketplacePage";
import { OwnerMyListingsPage } from "./pages/owner/MyListingsPage";
import { OwnerPaymentPage } from "./pages/owner/PaymentPage";
import { AccountPage } from "./pages/admin/AccountPage";
import { OwnersPage } from "./pages/admin/OwnersPage";
import { OwnerDetailPage } from "./pages/admin/OwnerDetailPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ContentPage } from "./pages/ContentPage";
import { BlogIndexPage } from "./pages/BlogIndexPage";
import { BlogPostPage } from "./pages/BlogPostPage";
import { AdminPagesPage } from "./pages/admin/PagesPage";
import { AdminPageEditPage } from "./pages/admin/PageEditPage";
import { AdminBlogPage } from "./pages/admin/BlogPage";
import { AdminBlogEditPage } from "./pages/admin/BlogEditPage";
import { AdminSeoPage } from "./pages/admin/SeoPage";
import { AdminStorePage } from "./pages/admin/StorePage";

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
  const isOwner = location.pathname.startsWith("/owner");

  if (isAdmin) {
    return (
      <>
        <ScrollToTop />
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
            <Route path="weeks" element={<AdminWeeksPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
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
            <Route path="users" element={<UsersPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Routes>
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  if (isOwner) {
    return (
      <>
        <ScrollToTop />
        <Routes>
          <Route path="/owner/login" element={<OwnerLoginPage />} />
          <Route path="/owner" element={<OwnerLayout />}>
            <Route index element={<OwnerDashboardPage />} />
            <Route path="properties" element={<OwnerPropertiesPage />} />
            {/* PropertyDetailPage removed — inline on PropertiesPage */}
            <Route path="inquiries" element={<OwnerInquiriesPage />} />
            <Route path="marketplace" element={<OwnerMarketplacePage />} />
            <Route path="listings" element={<OwnerMyListingsPage />} />
            <Route path="payment" element={<OwnerPaymentPage />} />
          </Route>
        </Routes>
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/community/:slug" element={<CommunityPage />} />
          <Route path="/property/:slug" element={<ErrorBoundary><PropertyPage /></ErrorBoundary>} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          {/* Catch-all for admin-authored content pages. MUST stay last —
              it shadows any route declared after it, and it also serves
              as the site's 404. */}
          <Route path="/:slug" element={<ContentPage />} />
        </Routes>
      </main>
      <Footer />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
