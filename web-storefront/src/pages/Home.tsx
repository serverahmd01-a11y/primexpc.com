import { Link } from 'react-router-dom';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Cpu, Fan, CircuitBoard, MemoryStick, HardDrive, MonitorSmartphone, Power, Box, Monitor, Keyboard, Headphones, Laptop, Zap, Shield, Truck, Wrench, Package, Heart, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import { fetchProducts, fetchCategories, fetchFeaturedProducts } from '@/data/products';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';
import type { Product } from '@/types';
import { FeaturedCardSkeleton, ProductCardSkeleton } from '@/components/Skeleton';
import api from '@/lib/api';

const catIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Processor: Cpu, 'CPU Cooler': Fan, Motherboard: CircuitBoard, RAM: MemoryStick,
  GPU: MonitorSmartphone, Storage: HardDrive, PSU: Power, Case: Box,
  Monitor: Monitor, Peripherals: Keyboard, Accessories: Headphones, Laptop: Laptop,
};

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const diff = new Date(endsAt).getTime() - now.getTime();
  if (diff <= 0) return <span className="text-[10px] font-bold text-destructive">Expired</span>;

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
      <span className="bg-primary/10 rounded px-1">{String(h).padStart(2, '0')}h</span>
      <span className="bg-primary/10 rounded px-1">{String(m).padStart(2, '0')}m</span>
      <span className="bg-primary/10 rounded px-1">{String(s).padStart(2, '0')}s</span>
    </span>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState({ products: false, featured: false });
  const [visibleCount, setVisibleCount] = useState(16);
  const [banners, setBanners] = useState<string[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const bannerLength = banners.length;

  const nextBanner = useCallback(() => setBannerIdx((p) => (p + 1) % bannerLength), [bannerLength]);
  const prevBanner = useCallback(() => setBannerIdx((p) => (p - 1 + bannerLength) % bannerLength), [bannerLength]);

  useEffect(() => {
    api.get('/settings/public/banners').then((r) => {
      if (Array.isArray(r.data) && r.data.length > 0) setBanners(r.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    bannerTimer.current = setInterval(nextBanner, 2000);
    return () => clearInterval(bannerTimer.current);
  }, [banners.length, nextBanner]);

  useEffect(() => { fetchProducts().then((d) => { setProducts(d); setLoaded((p) => ({ ...p, products: true })); }); }, []);
  useEffect(() => { fetchCategories(localStorage.getItem('primex_condition') || 'new').then(setCategories); }, []);
  useEffect(() => { fetchFeaturedProducts().then((d) => { setFeatured(d); setLoaded((p) => ({ ...p, featured: true })); }); }, []);
  useEffect(() => { if (loaded.products && loaded.featured) setLoading(false); }, [loaded]);

  const filtered: Product[] = activeCat
    ? products.filter((p) => p.category === activeCat)
    : products;

  return (
    <>

      <section className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="container mx-auto grid items-center gap-8 px-4 py-12 md:py-20 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary">
              <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> We Build Your Dream PC
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-black leading-tight text-foreground">
              Unleash <span className="text-primary">Prime</span> Performance.<br /> Built for Champions.
            </h1>
            <p className="mt-4 sm:mt-5 max-w-lg text-sm sm:text-base md:text-lg text-muted-foreground">
              Custom gaming rigs and workstations engineered with the latest processors, GPUs, and ultra-fast memory.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 sm:gap-3">
              <Link to={`/category/GPU?condition=${localStorage.getItem('primex_condition') || 'refurbished'}`} className="rounded-full bg-primary px-5 sm:px-8 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110">
                Buy Now
              </Link>
              <Link to="/sell" className="rounded-full border-2 border-orange-500 bg-orange-500/10 px-5 sm:px-8 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-orange-400 transition hover:bg-orange-500 hover:text-white flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Sell Your Old Hardware
              </Link>
            </div>
            <div className="mt-6 sm:mt-10 grid grid-cols-3 gap-3 sm:gap-4 max-w-md">
              {[{ v: '10K+', l: 'PCs Built' }, { v: '500+', l: 'Components' }, { v: '4.9★', l: 'Rated' }].map((s) => (
                <div key={s.l}><div className="font-display text-xl sm:text-2xl font-black text-primary">{s.v}</div><div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div></div>
              ))}
            </div>
          </div>
          <div className="relative flex justify-center overflow-visible">
            <span className="logo-ring-wrap logo-ring-wrap--glow-only"><img src="/primex-logo.jpeg" alt="PrimeX Technologies logo" className="relative z-10 w-48 sm:w-64 md:w-80 max-w-full rounded-full" /></span>
          </div>
        </div>
      </section>

      {banners.length > 0 && (
        <section className="container mx-auto px-4 py-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="relative aspect-[2/1] md:aspect-[2.5/1]">
              {banners.map((b, i) => (
                <img key={i} src={getImageUrl(b)} alt={`Banner ${i + 1}`}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === bannerIdx ? 'opacity-100' : 'opacity-0'}`}
                />
              ))}
            </div>
            {banners.length > 1 && (
              <>
                <button onClick={prevBanner} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition backdrop-blur-sm">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={nextBanner} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition backdrop-blur-sm">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setBannerIdx(i)}
                      className={`h-2 rounded-full transition ${i === bannerIdx ? 'w-6 bg-primary' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {(featured.length > 0 || loading) && (
        <section className="container mx-auto px-4 pb-12">
          <div className="mb-6 flex items-center gap-3">
            <Zap className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-display text-2xl font-black text-foreground">Hot Deals</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Limited time offers — grab them before they're gone!</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <FeaturedCardSkeleton key={i} />)
              : featured.map((p) => (
              <Link key={p._id} to={`/product/${p._id}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-primary/30 bg-card transition hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-glow)]">
                <div className="absolute left-3 top-3 z-10 rounded-md bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground animate-pulse">
                  HOT
                </div>
                <div className="flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-surface to-background">
                  {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt={p.name} className="h-full w-full object-cover" /> : <MemoryStick className="h-16 w-16 text-primary/40" strokeWidth={1.2} />}
                </div>
                <div className="flex flex-1 flex-col gap-2 border-t border-border p-4">
                  <h3 className="font-display text-sm font-bold leading-snug text-foreground line-clamp-2">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    {(p.salePrice && p.salePrice > 0) ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-display text-lg font-black text-primary">{formatINR(p.salePrice)}</span>
                        <span className="font-display text-lg font-black text-destructive line-through">{formatINR(p.price)}</span>
                        <span className="text-[10px] font-bold text-primary">-{Math.round((1 - p.salePrice / p.price) * 100)}%</span>
                      </div>
                    ) : (
                      <span className="font-display text-lg font-black text-primary">{formatINR(p.price)}</span>
                    )}
                  </div>
                  {p.dealEndsAt && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Ends in:</span>
                      <CountdownTimer endsAt={p.dealEndsAt} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div><h2 className="font-display text-3xl font-black text-foreground">Shop By Category</h2><p className="mt-1 text-sm text-muted-foreground">Every part you need for the perfect rig.</p></div>
          {categories.length > 6 && <Link to="/categories" className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-primary hover:underline">View All &rarr;</Link>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.slice(0, 6).map((c) => {
            const Icon = catIcons[c] || Box;
            return (
            <Link key={c} to={`/category/${encodeURIComponent(c)}?condition=${localStorage.getItem('primex_condition') || 'refurbished'}`} className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-glow)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-7 w-7" /></div>
              <span className="text-sm font-bold uppercase tracking-wider text-foreground">{c}</span>
            </Link>
            );
          })}
        </div>
      </section>

      <section id="products" className="bg-surface/40 py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-6 sm:mb-8 flex items-end justify-between">
            <div><div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary">Shop</div><h2 className="mt-1 font-display text-2xl sm:text-3xl font-black text-foreground">{activeCat ?? 'All Products'}</h2></div>
            {activeCat && <button onClick={() => setActiveCat(null)} className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary hover:underline">Clear filter x</button>}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 sm:p-16 text-center text-sm text-muted-foreground">No products yet{activeCat ? ` in ${activeCat}` : ''}.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {filtered.slice(0, visibleCount).map((p) => (
                <Link key={p._id} to={`/product/${p._id}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-card)]">
                  <span className="absolute right-2 sm:right-3 top-2 sm:top-3 z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition hover:text-primary"><Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
                  <div className="flex h-32 sm:h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-surface to-background">
                    {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt={p.name} className="h-full w-full object-cover" /> : <MemoryStick className="h-12 w-12 sm:h-20 sm:w-20 text-primary/40" strokeWidth={1.2} />}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 sm:gap-2 border-t border-border p-3 sm:p-4">
                    <h3 className="font-display text-xs sm:text-sm font-bold leading-snug text-foreground line-clamp-2">{p.name}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{p.category}</p>
                    <span className={`mt-0.5 sm:mt-1 inline-flex w-fit rounded px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-bold ${p.stock > 0 ? 'bg-primary/15 text-primary' : 'bg-destructive/20 text-destructive'}`}>{p.stock > 0 ? 'In Stock' : 'Out Of Stock'}</span>
                    <div className="mt-1 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
                      {p.salePrice && p.salePrice > 0 ? (
                        <><span className="font-display text-sm sm:text-lg font-black text-primary">{formatINR(p.salePrice)}</span><span className="font-display text-xs sm:text-lg font-black text-destructive line-through">{formatINR(p.price)}</span></>
                      ) : (
                        <span className="font-display text-sm sm:text-lg font-black text-primary">{formatINR(p.price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!loading && visibleCount < filtered.length && (
            <div className="mt-6 sm:mt-8 flex justify-center">
              <button onClick={() => setVisibleCount((c) => c + 16)} className="rounded-xl border border-primary bg-primary/10 px-6 sm:px-8 py-2.5 sm:py-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-glow)]">
                Load More ({filtered.length - visibleCount} left)
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[{ icon: Wrench, t: 'Expert Custom Builds', d: 'Hand-assembled by certified PC builders with rigorous testing.' }, { icon: Shield, t: 'Genuine Components', d: '100% authentic parts with full manufacturer warranty.' }, { icon: Truck, t: 'Pan-India Delivery', d: 'Safe, insured shipping straight to your doorstep.' }, { icon: Zap, t: 'Performance Tuned', d: 'BIOS, RAM and storage tuned for maximum FPS out of the box.' }].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-5 sm:p-6"><f.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /><h3 className="mt-3 sm:mt-4 font-display text-base sm:text-lg font-bold text-foreground">{f.t}</h3><p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">{f.d}</p></div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 p-6 sm:p-10 md:p-16 text-center" style={{ background: 'var(--gradient-hero)' }}>
          <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-black text-foreground">Ready to build your <span className="text-primary">dream rig?</span></h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-sm sm:text-base text-muted-foreground">Tell us your budget and use-case. We'll engineer a build that crushes it.</p>
            <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
              <Link to={`/category/GPU?condition=${localStorage.getItem('primex_condition') || 'refurbished'}`} className="rounded-full bg-primary px-5 sm:px-8 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110">Buy Now</Link>
              <Link to="/sell" className="rounded-full border-2 border-orange-500 bg-orange-500/10 px-5 sm:px-8 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-orange-400 shadow-[var(--shadow-glow)] transition hover:bg-orange-500 hover:text-white flex items-center gap-2"><Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Sell Your Old Hardware</Link>
            </div>
        </div>
      </section>
    </>
  );
}
