import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, Package, ClipboardList, Users, LogOut, ShoppingBag, Settings, Percent, Tag, Menu, X, FileText, Coins, PackagePlus, FileSpreadsheet, ScrollText, HelpCircle, Boxes } from 'lucide-react';
import { useState } from 'react';

const adminNav = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/stock', label: 'Quick Stock', icon: Boxes },
  { path: '/admin/categories', label: 'Categories', icon: Tag },
  { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { path: '/admin/invoices', label: 'Invoices', icon: FileSpreadsheet },
  { path: '/admin/missed-orders', label: 'Missed Orders', icon: PackagePlus },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/sell', label: 'Sell', icon: Coins },
  { path: '/admin/gst', label: 'GST', icon: Percent },
  { path: '/admin/pages', label: 'Pages', icon: FileText },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
  { path: '/admin/logs', label: 'Logs', icon: ScrollText },
  { path: '/admin/help', label: 'Help', icon: HelpCircle },
];

const caNav = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { path: '/admin/invoices', label: 'Invoices', icon: FileSpreadsheet },
  { path: '/admin/help', label: 'Help', icon: HelpCircle },
];

const shippingNav = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { path: '/admin/missed-orders', label: 'Missed Orders', icon: PackagePlus },
  { path: '/admin/help', label: 'Help', icon: HelpCircle },
];

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  ca: 'Chartered Accountant',
  shipping: 'Shipping',
};

export default function AdminLayout() {
  const { user, logout, isAdmin, isCA, isShipping } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = isAdmin ? adminNav : isCA ? caNav : isShipping ? shippingNav : [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface/60 transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-sm font-black tracking-wider">{roleLabel[user?.role || ''] || 'Staff'}</div>
            <div className="text-[10px] uppercase tracking-widest text-primary/70">PrimeX PC</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const isActive = item.end
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20">
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary">PrimeX Panel</div>
                <h1 className="font-display text-xl font-black">
                {nav.find((n) => {
                  if (n.end) return location.pathname === n.path;
                  return location.pathname.startsWith(n.path);
                })?.label || 'Dashboard'}
              </h1>
            </div>
            </div>
            <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">View Store →</Link>
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
