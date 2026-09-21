import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, ShoppingCart, ChevronDown, LogOut, Settings, Package, Menu, Zap, RefreshCw, X, ExternalLink, Phone, MessageCircle, Heart, Coins } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useCart, formatINR } from '@/lib/cart';
import { fetchCategories } from '@/data/products';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import type { Product } from '@/types';

export default function Layout() {
  const { user, logout, isStaff } = useAuth();
  const { count, open: openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [footerData, setFooterData] = useState<{ social_links: { platform: string; url: string; active: boolean }[]; custom_footer_links: { label: string; href: string }[] }>({ social_links: [], custom_footer_links: [] });
  const [storeInfo, setStoreInfo] = useState<Record<string, unknown>>({});
  const [storePhones, setStorePhones] = useState<{ label: string; number: string }[]>([]);
  const [condition, setCondition] = useState(() => localStorage.getItem('primex_condition') || 'refurbished');
  const [searchFocused, setSearchFocused] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { fetchCategories(condition).then(setCategories); }, [condition]);
  useEffect(() => { api.get('/products').then(({ data }) => setAllProducts(Array.isArray(data) ? data : [])).catch(() => {}); }, []);
  useEffect(() => { api.get('/settings/public/footer').then(({ data }) => { if (data) setFooterData(data); }).catch(() => {}); }, []);
  useEffect(() => { api.get('/settings/public/store-info').then(({ data }) => { if (data) { setStoreInfo(data); try { const raw = Array.isArray(data.store_phones) ? data.store_phones : JSON.parse(data.store_phones || '[]'); setStorePhones((Array.isArray(raw) ? raw : []).map((p: unknown) => (typeof p === 'string' ? { label: '', number: p } : (p as { label: string; number: string })))); } catch { setStorePhones([]); } } }).catch(() => {}); }, []);

  const catsWithCondition = categories.filter((c) =>
    allProducts.some((p) => p.category === c && p.condition === condition)
  );

  const safeCats = Array.isArray(catsWithCondition) ? catsWithCondition : [];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchQuery, allProducts]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getWhatsAppUrl = () => {
    let wa = String(storeInfo.store_whatsapp || storeInfo.store_phone || '9911652153').replace(/[^\d]/g, '');
    if (wa.startsWith('91')) wa = wa.slice(2);
    const msg = user
      ? `Hi, I'm ${user.name}. I need help with PrimeX PC products.`
      : 'Hi, I need help with PrimeX PC products.';
    return `https://wa.me/91${wa}?text=${encodeURIComponent(msg)}`;
  };

  const contactPhones = (storePhones.length > 0 ? storePhones : [{ label: 'Call Store', number: String(storeInfo.store_phone || '9911652153') }])
    .filter((p) => String(p.number || '').replace(/\D/g, '').length >= 10);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setSearchFocused(false);
      navigate(`/category/all?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden max-w-full">
      <div className="border-b border-border/60 bg-black/40 text-xs">
        <div className="container mx-auto flex items-center justify-between px-4 py-2 text-muted-foreground">
          <span>Free shipping on all orders · Expert PC builds · PAN India delivery</span>
          <div ref={contactRef} className="relative hidden md:block">
              <button onClick={() => setContactOpen(!contactOpen)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition">
              <Phone className="h-3 w-3" /> +91 {contactPhones.map((p) => String(p.number).replace(/[^\d]/g, '')).join(' / ')}
            </button>
            {contactOpen && (
              <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-border bg-card shadow-2xl z-50 py-1">
                {contactPhones.map((p, i) => (
                  <a key={i} href={`tel:+91${String(p.number).replace(/[^\d]/g, '')}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition">
                    <Phone className="h-4 w-4" />
                    <div>
                      <div className="font-semibold">{p.label || `Call ${i + 1}`}</div>
                      <div className="text-[11px] text-muted-foreground">+91 {String(p.number).replace(/[^\d]/g, '')}</div>
                    </div>
                  </a>
                ))}
                <a href={getWhatsAppUrl()} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition">
                  <MessageCircle className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">WhatsApp</div>
                    <div className="text-[11px] text-muted-foreground">Chat on WhatsApp</div>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-accent/20 hover:text-foreground transition">
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="flex items-center gap-3 shrink-0">
            <span className="logo-ring-wrap"><img src="/primex-logo.jpeg" alt="PrimeX" className="relative z-10 h-10 w-10 rounded-full object-cover" /></span>
            <div className="leading-tight hidden sm:block">
              <div className="font-display text-lg font-black tracking-wider text-foreground">PRIME<span className="text-primary">X</span> PC</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">High Performance Computing</div>
            </div>
          </Link>

          <div ref={searchRef} className="relative mx-4 hidden flex-1 md:block">
            <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(true); }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKey}
              placeholder="Search for products, components, builds…"
              className="h-11 w-full rounded-full border border-border bg-input pl-11 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery ? (
              <button onClick={() => { setSearchQuery(''); setSearchFocused(false); }} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full hover:bg-accent/20 text-muted-foreground hover:text-foreground transition">
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={() => searchQuery.trim() && navigate(`/category/all?search=${encodeURIComponent(searchQuery.trim())}`)} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Search className="h-4 w-4" />
              </button>
            )}

            {searchQuery.trim() && searchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-2xl max-h-96 overflow-y-auto z-50">
                {searchResults.slice(0, 8).map((p) => (
                  <Link key={p._id} to={`/product/${p._id}`} onClick={() => { setSearchQuery(''); setSearchFocused(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/10 transition border-b border-border/40 last:border-0">
                    <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center overflow-hidden shrink-0">
                      {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{formatINR(p.salePrice || p.price)}</p>
                      {(p.salePrice && p.salePrice > 0) && <p className="text-[10px] text-muted-foreground line-through">{formatINR(p.price)}</p>}
                    </div>
                  </Link>
                ))}
                {searchResults.length > 8 && (
                  <Link to={`/category/all?search=${encodeURIComponent(searchQuery.trim())}`} onClick={() => setSearchFocused(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition border-t border-border">
                    <ExternalLink className="h-3 w-3" /> View all {searchResults.length} results
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-muted-foreground ml-auto">
            {user ? (
              <div className="relative group hidden md:block before:absolute before:inset-x-0 before:top-full before:h-4">
                <button className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{user.name?.charAt(0).toUpperCase()}</div>
                  {user.name} <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-card shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible hover:opacity-100 hover:visible transition-all duration-200 z-50">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-bold text-foreground">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition"><User className="h-3.5 w-3.5" /> Profile</Link>
                    <Link to="/orders" className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition"><Package className="h-3.5 w-3.5" /> My Orders</Link>
                    {isStaff && (
                      <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition"><Settings className="h-3.5 w-3.5" /> Admin Panel</Link>
                    )}
                    <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-destructive/10 hover:text-destructive transition"><LogOut className="h-3.5 w-3.5" /> Sign Out</button>
                  </div>
                </div>
              </div>
            ) : (
              <Link to="/auth" className="hidden rounded-full border border-primary/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary transition hover:bg-primary/10 md:inline-flex">Sign In</Link>
            )}
            <Link to={user ? '/profile' : '/auth'} className="md:hidden">
              <User className={`h-5 w-5 cursor-pointer hover:text-primary ${user ? 'text-primary' : ''}`} />
            </Link>

            <Link to="/cart" className="relative" aria-label="Cart">
              <ShoppingCart className="h-5 w-5 cursor-pointer hover:text-primary" />
              {count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{count > 9 ? '9+' : count}</span>
              )}
            </Link>
          </div>
        </div>

        {/* Condition Tabs */}
        <div className="border-t border-border/40 bg-surface/30 px-2 py-2 mt-1">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {(['new', 'refurbished'] as const).map((c) => (
              <button key={c}
                onClick={() => {
                  setCondition(c);
                  localStorage.setItem('primex_condition', c);
                  navigate(`/category/all?condition=${c}`, { replace: true });
                }}
                className={`flex-1 rounded-full px-6 sm:px-10 py-3 sm:py-3.5 text-sm sm:text-base font-bold uppercase tracking-wider transition ${
                  condition === c
                    ? c === 'new' ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'bg-amber-500 text-white shadow-[var(--shadow-glow)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}>
                {c === 'new' ? <><Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 inline -mt-0.5" /> New</> : <><RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 inline -mt-0.5" /> Refurbished</>}
              </button>
            ))}
          </div>
        </div>

        {/* Sell Old GPU */}
        <div className="px-4 pb-2">
          <Link to="/sell" className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 h-12 sm:h-14 text-sm sm:text-base font-bold uppercase tracking-wider text-white mx-auto w-full max-w-[488px] shadow-[var(--shadow-glow)] hover:brightness-110 transition">
            <Coins className="h-4 w-4 sm:h-5 sm:w-5" /> Sell your old GPU
          </Link>
        </div>

        {/* Desktop Category Nav (mobile ma hamburger menu ma made) */}
        <nav className="border-t border-border hidden md:block">
          <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto whitespace-nowrap hide-scrollbar">
            {[`/category/all?condition=${condition}`, ...safeCats.map((c) => `/category/${encodeURIComponent(c)}?condition=${condition}`)].map((to) => {
              let label: string;
              try {
                label = to.startsWith('/category/all') ? 'All' : decodeURIComponent(to.split('/category/')[1].split('?')[0]);
              } catch {
                label = to.startsWith('/category/all') ? 'All' : to.split('/category/')[1]?.split('?')[0] || '';
              }
              const isActive = location.pathname === to.split('?')[0];
              const onCatPage = location.pathname.includes('/category/');
              return (
                <Link key={to} to={to} replace={onCatPage} className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}>
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-background/98 backdrop-blur md:hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
              <span className="logo-ring-wrap"><img src="/primex-logo.jpeg" alt="Logo" className="relative z-10 h-8 w-8 rounded-full" /></span>
              <span className="font-display font-black tracking-wider">PRIME<span className="text-primary">X</span></span>
            </Link>
            <button onClick={() => setMenuOpen(false)} className="rounded-full p-2 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categories</div>
              <div className="grid grid-cols-2 gap-1.5">
                <Link to={`/category/all?condition=${condition}`} onClick={() => setMenuOpen(false)} className="rounded-lg bg-surface/60 px-3 py-2.5 text-xs font-bold text-primary border border-primary/20">
                  All Products
                </Link>
                {safeCats.map((c) => (
                  <Link key={c} to={`/category/${encodeURIComponent(c)}?condition=${condition}`} onClick={() => setMenuOpen(false)} className="truncate rounded-lg bg-surface/60 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary border border-border/60">
                    {c}
                  </Link>
                ))}
              </div>
            </div>
            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">More</div>
              <Link to="/sell" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/10">
                <Coins className="h-4 w-4 text-muted-foreground" /> Sell your old hardware
              </Link>
              <Link to="/contact" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/10">
                <Phone className="h-4 w-4 text-muted-foreground" /> Contact Us
              </Link>
            </div>
            <div className="border-t border-border/60 pt-3">
              {user ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-surface/50 rounded-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{user.name?.charAt(0).toUpperCase()}</div>
                    <div><p className="text-sm font-semibold">{user.name}</p><p className="text-[11px] text-muted-foreground truncate">{user.email}</p></div>
                  </div>
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/10">
                    <User className="h-4 w-4 text-muted-foreground" /> My Profile
                  </Link>
                  <Link to="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/10">
                    <Package className="h-4 w-4 text-muted-foreground" /> My Orders
                  </Link>
                  {isStaff && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/10">
                      <Settings className="h-4 w-4 text-muted-foreground" /> Admin Panel
                    </Link>
                  )}
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              ) : (
                <Link to="/auth" onClick={() => setMenuOpen(false)} className="block rounded-full bg-primary text-center px-4 py-3 text-sm font-bold text-primary-foreground">Sign In / Register</Link>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden"><Outlet /></main>

      <footer className="border-t border-border bg-black/60">
        <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="logo-ring-wrap"><img src="/primex-logo.jpeg" alt="PrimeX logo" className="relative z-10 h-[52px] w-[52px] rounded-full object-cover" /></span>
              <div><div className="font-display font-black tracking-wider">PRIME<span className="text-primary">X</span> PC</div><div className="text-[10px] uppercase tracking-widest text-primary/70">High Performance Computing</div></div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-md">Custom PC builds and premium components for gamers, creators and pros. PAN India delivery with free shipping.</p>
          </div>

          <div className="md:col-span-4 -mx-4 px-4 py-6 border-y border-border/40 bg-black/40 my-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[
                ...contactPhones.slice(2).map((p, i) => ({
                  isPhone: true,
                  number: String(p.number).replace(/[^\d]/g, ''),
                  title: p.label || `Call ${i + 3}`,
                  desc: `+91 ${String(p.number).replace(/[^\d]/g, '')}`,
                })),
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" className="h-8 w-8"><g fill="none"><path d="M16.3048 33.8134C20.4822 37.984 25.0579 41.7356 29.9664 45.0145C32.0618 46.4133 34.5761 47.0455 37.084 46.8041C39.5919 46.5628 41.9395 45.4628 43.7298 43.69L45.3033 42.1161C46.3034 41.1067 46.8645 39.7433 46.8645 38.3223C46.8645 36.9014 46.3034 35.538 45.3033 34.5286L41.4139 30.6392C40.8732 30.1127 40.2292 29.7039 39.5226 29.4387C38.8161 29.1735 38.0622 29.0576 37.3086 29.0983C36.555 29.139 35.818 29.3354 35.1441 29.6752C34.4702 30.0149 33.874 30.4906 33.3931 31.0723C33.0789 31.3898 32.6656 31.5904 32.2217 31.6406C31.7778 31.6908 31.33 31.5877 30.9528 31.3483C25.9901 28.212 21.7888 24.0089 18.6546 19.0448C18.4179 18.6685 18.3171 18.2225 18.369 17.781C18.4209 17.3395 18.6224 16.929 18.94 16.6179C19.5224 16.1376 19.9989 15.5416 20.3391 14.8676C20.6794 14.1937 20.876 13.4564 20.9166 12.7026C20.9573 11.9487 20.8409 11.1946 20.5751 10.488C20.3092 9.78135 19.8996 9.13762 19.3721 8.5975L15.4827 4.70765C14.4757 3.70293 13.1113 3.13867 11.6888 3.13867C10.2663 3.13867 8.90189 3.70293 7.8949 4.70765L6.32057 6.28233C4.55279 8.04649 3.44754 10.3664 3.19125 12.8506C2.93497 15.3349 3.54332 17.8316 4.91371 19.9195C8.23982 24.9177 12.0557 29.5719 16.3048 33.8134ZM7.42531 7.38708C8.57813 6.23371 9.89787 4.58154 11.6891 4.70087C12.1884 4.69992 12.683 4.79762 13.1444 4.98837C13.6059 5.17911 14.0251 5.45914 14.378 5.81237L18.2675 9.70221C18.6495 10.098 18.9436 10.5701 19.1305 11.0875C19.3175 11.6049 19.393 12.1559 19.3521 12.7045C19.3113 13.2531 19.155 13.7869 18.8935 14.2709C18.632 14.7549 18.2712 15.1782 17.8347 15.5131C17.2653 16.0742 16.9051 16.8132 16.8138 17.6074C16.7226 18.4016 16.9059 19.2031 17.3332 19.8787C20.5914 25.0393 24.959 29.4086 30.1182 32.669C30.7945 33.0999 31.598 33.2862 32.395 33.1966C33.1919 33.1071 33.9341 32.7472 34.4979 32.1769C34.8758 31.7101 35.3504 31.3308 35.8889 31.065C36.4274 30.7991 37.0172 30.6531 37.6175 30.6369C38.1171 30.6345 38.6121 30.7311 39.0741 30.9211C39.5361 31.1111 39.9559 31.3908 40.3092 31.744L44.1986 35.6334C44.5529 35.9857 44.8337 36.4048 45.0249 36.8663C45.2161 37.3279 45.3138 37.8228 45.3125 38.3224C45.4363 40.111 43.7576 41.4531 42.625 42.5853C41.0906 44.1032 39.0791 45.0447 36.9306 45.2505C34.782 45.4562 32.6284 44.9136 30.8338 43.7144C21.0821 37.1978 12.7154 28.817 6.21529 19.0543C5.04371 17.2673 4.52432 15.1309 4.74475 13.0054C4.96518 10.88 5.91193 8.89564 7.42531 7.38708Z" fill="currentColor"></path><path d="M25.2663 5.35542C35.6875 5.13781 44.8723 14.3235 44.6551 24.7441C44.6585 24.9491 44.7423 25.1446 44.8885 25.2883C45.0346 25.4321 45.2315 25.5126 45.4365 25.5126C45.6415 25.5126 45.8383 25.432 45.9845 25.2882C46.1306 25.1444 46.2144 24.9489 46.2177 24.7439C46.4518 13.4844 36.5293 3.55985 25.2692 3.79309C25.064 3.79573 24.868 3.879 24.7237 4.0249C24.5794 4.1708 24.4983 4.36762 24.498 4.57283C24.4976 4.77804 24.578 4.97516 24.7217 5.12159C24.8655 5.26803 25.0611 5.35202 25.2663 5.35542Z" fill="currentColor"></path><path d="M24.4865 17.4092C24.4866 17.6164 24.5689 17.8151 24.7154 17.9616C24.8619 18.1081 25.0606 18.1904 25.2678 18.1904C27.0031 18.1988 28.6649 18.8918 29.8919 20.1189C31.1189 21.3459 31.8119 23.0077 31.8202 24.743C31.8202 24.8456 31.8405 24.9472 31.8797 25.042C31.919 25.1368 31.9765 25.2229 32.0491 25.2954C32.1216 25.368 32.2078 25.4255 32.3026 25.4648C32.3974 25.504 32.499 25.5243 32.6016 25.5242C32.7042 25.5242 32.8057 25.504 32.9005 25.4648C32.9953 25.4255 33.0815 25.3679 33.154 25.2954C33.2265 25.2228 33.2841 25.1367 33.3234 25.0419C33.3626 24.9471 33.3828 24.8455 33.3828 24.7429C33.3825 22.5908 32.5275 20.5269 31.0057 19.0051C29.4839 17.4833 27.4199 16.6282 25.2678 16.6279C25.0606 16.6279 24.8619 16.7103 24.7154 16.8568C24.5689 17.0033 24.4866 17.202 24.4865 17.4092Z" fill="currentColor"></path><path d="M38.2378 24.7439C38.2408 24.9491 38.3245 25.1449 38.4707 25.2889C38.6169 25.4329 38.8138 25.5136 39.0191 25.5136C39.2243 25.5136 39.4212 25.4329 39.5674 25.2889C39.7136 25.1448 39.7972 24.9491 39.8003 24.7439C39.9615 16.9318 33.0793 10.0493 25.2669 10.2108C25.0624 10.2148 24.8676 10.2989 24.7244 10.445C24.5811 10.591 24.5009 10.7875 24.5009 10.9921C24.5009 11.1966 24.5812 11.3931 24.7245 11.5391C24.8677 11.6852 25.0626 11.7692 25.2671 11.7732C28.7022 11.7892 31.9921 13.1609 34.4211 15.5899C36.8501 18.0189 38.2218 21.3088 38.2378 24.7439Z" fill="currentColor"></path></g></svg>,
                  title: contactPhones[0]?.label || 'Customer Care',
                  desc: '+91 ' + String(contactPhones[0]?.number || String(storeInfo.store_phone || '9911652153')).replace(/[^\d]/g, '')
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>,
                  title: contactPhones[1]?.label || 'Support',
                  desc: contactPhones[1] ? '+91 ' + String(contactPhones[1].number).replace(/[^\d]/g, '') : '',
                  skip: !contactPhones[1]
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor"><path d="m19,6h-2.113c-.285-1.383-1.14-2.61-2.387-3.33-.479-.278-1.089-.113-1.366.364-.276.479-.113,1.09.365,1.366.925.535,1.5,1.531,1.5,2.6v11H4c-1.103,0-2-.897-2-2v-3c0-.553-.448-1-1-1s-1,.447-1,1v3c0,1.881,1.309,3.452,3.061,3.877-.038.204-.061.412-.061.623,0,1.93,1.57,3.5,3.5,3.5s3.5-1.57,3.5-3.5c0-.169-.017-.335-.041-.5h4.082c-.024.165-.041.331-.041.5,0,1.93,1.57,3.5,3.5,3.5s3.5-1.57,3.5-3.5c0-.211-.024-.419-.061-.623,1.752-.425,3.061-1.996,3.061-3.877v-5c0-2.757-2.243-5-5-5Zm3,5v1h-5v-4h2c1.654,0,3,1.346,3,3Zm-14,9.5c0,.827-.673,1.5-1.5,1.5s-1.5-.673-1.5-1.5c0-.189.039-.355.093-.5h2.815c.054.145.093.311.093.5Zm9.5,1.5c-.827,0-1.5-.673-1.5-1.5,0-.189.039-.355.093-.5h2.815c.054.145.093.311.093.5,0,.827-.673,1.5-1.5,1.5Zm2.5-4h-3v-4h5v2c0,1.103-.897,2-2,2ZM3,10h5c1.654,0,3-1.346,3-3V3c0-1.654-1.346-3-3-3H3C1.346,0,0,1.346,0,3v4c0,1.654,1.346,3,3,3Zm-1-7c0-.552.449-1,1-1h5c.551,0,1,.448,1,1v4c0,.552-.449,1-1,1H3c-.551,0-1-.448-1-1V3Zm2,1c0-.553.448-1,1-1h1c.552,0,1,.447,1,1s-.448,1-1,1h-1c-.552,0-1-.447-1-1Z"></path></svg>,
                  title: 'Free Shipping',
                  desc: 'We Deliver All Across India'
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor"><path d="m8.5,9.5c0,.551.128,1.073.356,1.537-.49.628-.795,1.407-.836,2.256-.941-.988-1.52-2.324-1.52-3.792,0-3.411,3.122-6.107,6.659-5.381,2.082.428,3.769,2.105,4.213,4.184.134.628.159,1.243.091,1.831-.058.498-.495.866-.997.866h-.045c-.592,0-1.008-.527-.943-1.115.044-.395.021-.81-.08-1.233-.298-1.253-1.32-2.268-2.575-2.557-2.286-.525-4.324,1.207-4.324,3.405Zm-3.89-1.295c.274-1.593,1.053-3.045,2.261-4.178,1.529-1.433,3.531-2.141,5.63-2.011,3.953.256,7.044,3.719,6.998,7.865-.019,1.736-1.473,3.118-3.208,3.118h-2.406c-.244-.829-1.002-1.439-1.91-1.439-1.105,0-2,.895-2,2s.895,2,2,2c.538,0,1.025-.215,1.384-.561h2.932c2.819,0,5.168-2.245,5.208-5.063C21.573,4.715,17.651.345,12.63.021c-2.664-.173-5.191.732-7.126,2.548-1.499,1.405-2.496,3.265-2.855,5.266-.109.608.372,1.166.989,1.166.472,0,.893-.329.972-.795Zm7.39,8.795c-3.695,0-6.892,2.292-7.955,5.702-.165.527.13,1.088.657,1.253.526.159,1.087-.131,1.252-.657.789-2.53,3.274-4.298,6.045-4.298s5.257,1.768,6.045,4.298c.134.428.528.702.955.702.099,0,.198-.015.298-.045.527-.165.821-.726.657-1.253-1.063-3.41-4.26-5.702-7.955-5.702Z"></path></svg>,
                  title: 'Customer Support',
                  desc: 'Expert is Here to Help'
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor"><path d="m5.5 11c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5zm18.5-6v4c0 .552-.447 1-1 1s-1-.448-1-1v-2h-20v6c0 1.654 1.346 3 3 3h2c.553 0 1 .448 1 1s-.447 1-1 1h-2c-2.757 0-5-2.243-5-5v-8c0-2.757 2.243-5 5-5h14c2.757 0 5 2.243 5 5zm-2 0c0-1.654-1.346-3-3-3h-14c-1.654 0-3 1.346-3 3zm2 12c0 3.86-3.141 7-7 7s-7-3.14-7-7 3.141-7 7-7 7 3.14 7 7zm-2 0c0-2.757-2.243-5-5-5s-5 2.243-5 5 2.243 5 5 5 5-2.243 5-5zm-3.192-1.242-2.223 2.134c-.144.14-.379.143-.522 0l-1.131-1.108c-.396-.386-1.028-.379-1.414.015-.387.395-.381 1.027.014 1.414l1.131 1.108c.46.45 1.062.674 1.664.674s1.2-.224 1.653-.671l2.213-2.124c.398-.383.411-1.016.029-1.414-.383-.398-1.017-.411-1.414-.029z"></path></svg>,
                  title: 'Online Payment',
                  desc: '100% Secure Checkout'
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor"><path d="m23.396 10.431-2.427-5.462c-.802-1.804-2.595-2.969-4.569-2.969h-5.4c-.553 0-1 .447-1 1s.447 1 1 1h1v6h-5.5c-.553 0-1 .447-1 1s.447 1 1 1h15.315c.11.415.185.837.185 1.273v1.727c0 1.103-.897 2-2 2h-16c-1.103 0-2-.897-2-2 0-.553-.447-1-1-1s-1 .447-1 1c0 1.859 1.279 3.411 3 3.858v.642c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5v-.5h4v.5c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5v-.642c1.721-.447 3-1.999 3-3.858v-1.727c0-.987-.203-1.944-.604-2.843zm-15.396 9.069c0 .827-.673 1.5-1.5 1.5s-1.5-.673-1.5-1.5v-.5h3zm9.5 1.5c-.827 0-1.5-.673-1.5-1.5v-.5h3v.5c0 .827-.673 1.5-1.5 1.5zm-3.5-17h2.4c1.185 0 2.261.699 2.741 1.781l1.875 4.219h-7.016zm-14-1c0-.553.447-1 1-1h6c.553 0 1 .447 1 1s-.447 1-1 1h-6c-.553 0-1-.447-1-1zm0 4c0-.553.447-1 1-1h4c.553 0 1 .447 1 1s-.447 1-1 1h-4c-.553 0-1-.447-1-1zm0 4c0-.553.447-1 1-1h2c.553 0 1 .447 1 1s-.447 1-1 1h-2c-.553 0-1-.447-1-1z"></path></svg>,
                  title: 'Fast Delivery',
                  desc: 'Fast & Reliable Delivery'
                },
                {
                  isSocial: true,
                  title: 'Follow Us',
                  desc: 'Stay connected'
                }
              ].map((item: any, idx) => {
                if (item.skip) return null;
                if (item.isPhone) {
                  return (
                    <a key={`phone-${idx}`} href={`tel:+91${item.number}`} className="flex flex-col items-center gap-2 text-center hover:opacity-80 transition">
                      <span className="text-primary"><Phone className="h-8 w-8" /></span>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">{item.desc}</p>
                      </div>
                    </a>
                  );
                }
                if (item.isSocial) {
                  const activeSocialLinks = footerData.social_links.filter((s) => s.active && /^https?:\/\//i.test(s.url));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 text-center">
                      <div className="flex gap-2">
                        {activeSocialLinks.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.platform}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/10 transition">
                            <SocialIcon platform={s.platform} />
                          </a>
                        ))}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">{item.desc}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 text-center">
                    <span className="text-primary">{item.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                      <p className="text-[11px] text-muted-foreground leading-tight">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="border-t border-border/40 bg-black/60">
          <div className="container mx-auto flex flex-col items-center gap-3 px-4 py-5 md:flex-row md:justify-between">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              Copyright &copy; 2021-{new Date().getFullYear()} <a href="/" className="font-bold text-primary hover:underline">PrimeX PC</a>
            </p>
          </div>
        </div>
      </footer>

      <a href={getWhatsAppUrl()} target="_blank" rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_0_30px_8px_rgba(37,211,102,0.4)] hover:scale-110 hover:brightness-110 transition-all duration-200"
        aria-label="Chat on WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'facebook') return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 5.99 4.388 10.955 10.125 11.855v-8.387H7.078V12.07h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.492 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.387C19.614 23.028 24 18.063 24 12.073z"/></svg>;
  if (p === 'twitter' || p === 'x') return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
  if (p === 'instagram') return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
  if (p === 'youtube') return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
  if (p === 'linkedin') return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
  if (p === 'whatsapp') return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
  return <Heart className="h-5 w-5" />;
}
