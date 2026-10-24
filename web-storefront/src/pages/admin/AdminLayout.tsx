import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard, Package, ClipboardList, Users, LogOut, ShoppingBag, Settings, Percent, Tag,
  Menu, X, FileText, Coins, PackagePlus, FileSpreadsheet, ScrollText, HelpCircle, Boxes,
  BarChart3, ChevronDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type NavItem = { path: string; label: string; icon: typeof Package; end?: boolean };
type NavGroup = { label: string; icon: typeof Package; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: 'Catalog', icon: Package,
    items: [
      { path: '/admin/products', label: 'Products', icon: Tag },
      { path: '/admin/stock', label: 'Quick Stock', icon: Boxes },
      { path: '/admin/categories', label: 'Categories', icon: Tag },
    ],
  },
  {
    label: 'Orders', icon: ClipboardList,
    items: [
      { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
      { path: '/admin/invoices', label: 'Invoices', icon: FileSpreadsheet },
      { path: '/admin/missed-orders', label: 'Missed Orders', icon: PackagePlus },
    ],
  },
  {
    label: 'Customers', icon: Users,
    items: [{ path: '/admin/customers', label: 'Customers', icon: Users }],
  },
  {
    label: 'Sell', icon: Coins,
    items: [
      { path: '/admin/sell', label: 'Sell Leads', icon: Coins },
      { path: '/admin/sell/products', label: 'Sell Products', icon: Package },
    ],
  },
  {
    label: 'Reports', icon: BarChart3,
    items: [{ path: '/admin/reports', label: 'Reports', icon: BarChart3 }],
  },
  {
    label: 'Finance', icon: Percent,
    items: [{ path: '/admin/gst', label: 'GST', icon: Percent }],
  },
  {
    label: 'Content', icon: FileText,
    items: [{ path: '/admin/pages', label: 'Pages', icon: FileText }],
  },
  {
    label: 'System', icon: Settings,
    items: [
      { path: '/admin/settings', label: 'Settings', icon: Settings },
      { path: '/admin/bots', label: 'Bots', icon: Coins },
      { path: '/admin/logs', label: 'Logs', icon: ScrollText },
      { path: '/admin/help', label: 'Help', icon: HelpCircle },
    ],
  },
];

const DASHBOARD: NavItem = { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true };

// Role → which group labels (and items) are visible.
const ROLE_GROUPS: Record<string, string[]> = {
  admin: GROUPS.map((g) => g.label),
  ca: ['Orders', 'Reports', 'Finance'],
  shipping: ['Orders'],
};
const ROLE_ITEMS: Record<string, Record<string, string[]>> = {
  ca: { Orders: ['/admin/orders', '/admin/invoices'], System: ['/admin/help'] },
  shipping: { Orders: ['/admin/orders', '/admin/missed-orders'], System: ['/admin/help'] },
};

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
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const role = isAdmin ? 'admin' : isCA ? 'ca' : isShipping ? 'shipping' : '';
  const allowedGroups = GROUPS
    .filter((g) => ROLE_GROUPS[role]?.includes(g.label))
    .map((g) => ({ ...g, items: g.items.filter((i) => !ROLE_ITEMS[role]?.[g.label] || ROLE_ITEMS[role][g.label].includes(i.path)) }))
    .filter((g) => g.items.length > 0);

  const isActive = (item: NavItem) =>
    item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);

  // Keep the group containing the current page open (also on first load).
  useEffect(() => {
    for (const g of allowedGroups) {
      if (g.items.some((i) => isActive(i))) {
        setOpenGroups((prev) => (prev.includes(g.label) ? prev : [...prev, g.label]));
      }
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const currentItemLabel = (item: NavItem) => item.label;
  const activeLabel =
    isActive(DASHBOARD) ? DASHBOARD.label :
    allowedGroups.flatMap((g) => g.items).find((i) => isActive(i))?.label || 'Dashboard';

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

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <Link
            to={DASHBOARD.path}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              isActive(DASHBOARD) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <DASHBOARD.icon className="h-4 w-4" />
            {DASHBOARD.label}
          </Link>

          {allowedGroups.map((g) => {
            const open = openGroups.includes(g.label);
            const groupActive = g.items.some((i) => isActive(i));
            return (
              <div key={g.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    groupActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <g.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{g.label}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="mt-0.5 space-y-0.5 pl-2">
                    {g.items.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          isActive(item)
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20">
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary">PrimeX Panel</div>
                <h1 className="font-display text-xl font-black">{activeLabel}</h1>
              </div>
            </div>
            <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">View Store →</Link>
          </div>
        </header>
        <div className="p-3 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
