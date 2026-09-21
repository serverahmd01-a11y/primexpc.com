import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { CartDrawer } from '@/components/CartDrawer';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import ProductDetail from '@/pages/ProductDetail';
import CategoryPage from '@/pages/CategoryPage';
import AllCategories from '@/pages/AllCategories';
import CartPage from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import OrdersPage from '@/pages/Orders';
import NotFound from '@/pages/NotFound';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminProducts from '@/pages/admin/Products';
import AdminOrders from '@/pages/admin/Orders';
import AdminInvoices from '@/pages/admin/Invoices';
import AdminOrderDetail from '@/pages/admin/OrderDetail';
import AdminMissedOrders from '@/pages/admin/MissedOrders';
import AdminCustomers from '@/pages/admin/Customers';
import AdminCustomerDetail from '@/pages/admin/CustomerDetail';
import AdminSettings from '@/pages/admin/Settings';
import AdminGst from '@/pages/admin/Gst';
import AdminCategories from '@/pages/admin/Categories';
import AdminPages from '@/pages/admin/Pages';
import PageView from '@/pages/PageView';
import SitemapPage from '@/pages/SitemapPage';
import Contact from '@/pages/Contact';
import ResetPassword from '@/pages/ResetPassword';
import SellHome from '@/pages/SellHome';
import SellSubmit from '@/pages/SellSubmit';
import SellStatus from '@/pages/SellStatus';
import AdminSellLeads from '@/pages/admin/SellLeads';
import AdminSellLeadDetail from '@/pages/admin/SellLeadDetail';
import AdminSellProducts from '@/pages/admin/SellProducts';
import AdminLogs from '@/pages/admin/Logs';
import AdminHelp from '@/pages/admin/AdminHelp';
import AdminStock from '@/pages/admin/Stock';
import { pageView } from '@/lib/analytics';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isStaff } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isStaff) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/categories" element={<AllCategories />} />
        <Route path="/category/:categoryName" element={<CategoryPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/page/:slug" element={<PageView />} />
        <Route path="/sitemap" element={<SitemapPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/sell" element={<SellHome />} />
        <Route path="/sell/submit" element={<SellSubmit />} />
        <Route path="/sell/status" element={<SellStatus />} />
        <Route path="/sell/leads" element={<SellHome />} />
      </Route>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminOnly><AdminProducts /></AdminOnly>} />
        <Route path="stock" element={<AdminOnly><AdminStock /></AdminOnly>} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="missed-orders" element={<AdminOnly><AdminMissedOrders /></AdminOnly>} />
        <Route path="customers" element={<AdminOnly><AdminCustomers /></AdminOnly>} />
        <Route path="customers/:customerId" element={<AdminOnly><AdminCustomerDetail /></AdminOnly>} />
        <Route path="settings" element={<AdminOnly><AdminSettings /></AdminOnly>} />
        <Route path="gst" element={<AdminOnly><AdminGst /></AdminOnly>} />
        <Route path="categories" element={<AdminOnly><AdminCategories /></AdminOnly>} />
        <Route path="pages" element={<AdminOnly><AdminPages /></AdminOnly>} />
        <Route path="sell" element={<AdminSellLeads />} />
        <Route path="sell/leads/:leadId" element={<AdminSellLeadDetail />} />
        <Route path="sell/products" element={<AdminOnly><AdminSellProducts /></AdminOnly>} />
        <Route path="logs" element={<AdminOnly><AdminLogs /></AdminOnly>} />
        <Route path="help" element={<AdminHelp />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; }, []);
  useEffect(() => { window.scrollTo(0, 0); pageView(pathname); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
          <CartDrawer />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
