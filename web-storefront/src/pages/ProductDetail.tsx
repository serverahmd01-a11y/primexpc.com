import { Link, useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { ChevronRight, ChevronLeft, Heart, Minus, Plus, Shield, ShoppingCart, Truck, Check, X, MemoryStick } from 'lucide-react';
import { fetchProductById, fetchProducts } from '@/data/products';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';
import type { Product } from '@/types';
import { viewItem } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { userApi } from '@/lib/api';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { add } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setActiveImg(0);
    setQty(1);
    setWishlisted(false);
    let stale = false;
    Promise.all([fetchProductById(id), fetchProducts()])
      .then(([p, all]) => {
        if (stale) return;
        setProduct(p);
        setRelated(all.filter((x) => x._id !== id).slice(0, 3));
        setLoading(false);
        if (p) {
          viewItem({ id: p._id, name: p.name, price: p.salePrice || p.price, category: p.category });
        }
      })
      .catch(() => {
        if (stale) return;
        setProduct(null);
        setLoading(false);
      });
    return () => {
      stale = true;
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, [id]);

  useEffect(() => {
    if (!user) { setWishlisted(false); return; }
    userApi.getWishlist()
      .then((d) => {
        const list = (d.wishlist || []) as { _id: string }[];
        setWishlisted(list.some((w) => String(w._id) === id));
      })
      .catch(() => {});
  }, [user, id]);

  useEffect(() => {
    if (!product) return;
    if (product.video) setActiveImg(-1);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const images = product.images || [];
    if (images.length <= 1) return;
    // Video slide plays fully (driven by onEnded) — never auto-cut it.
    if (activeImg === -1) return;
    const timer = setInterval(() => {
      setActiveImg((prev) => {
        const next = (prev + 1) % images.length;
        // wrap back to the video at the end of the image loop, if a video exists
        if (next === 0 && product.video) return -1;
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [product, activeImg]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!product) return (
    <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-center"><h1 className="font-display text-3xl font-black">Product not found</h1><Link to="/" className="mt-4 inline-block text-primary underline">Back to home</Link></div></div>
  );

  const handleAdd = () => { add(product, qty); setAdded(true); if (addedTimer.current) clearTimeout(addedTimer.current); addedTimer.current = setTimeout(() => setAdded(false), 2000); };
  const handleWishlist = () => {
    if (!user) { window.location.href = '/auth'; return; }
    if (!product) return;
    if (wishlisted) {
      userApi.removeFromWishlist(product._id).then(() => setWishlisted(false)).catch(() => {});
    } else {
      userApi.addToWishlist(product._id).then(() => setWishlisted(true)).catch(() => {});
    }
  };
  const images = product.images || [];
  const totalSlides = (images.length || 0) + (product.video ? 1 : 0);
  const safeActive = activeImg >= images.length ? 0 : activeImg;

  const goLeft = () => {
    setActiveImg((prev) => {
      if (prev <= 0) return images.length - 1;
      return prev - 1;
    });
  };
  const goRight = () => {
    setActiveImg((prev) => {
      if (product.video && prev === -1) return 0;
      return (prev + 1) % images.length;
    });
  };

  return (
    <div>
      <div className="container mx-auto px-4 py-4 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden"><Link to="/" className="shrink-0 hover:text-primary">Home</Link><ChevronRight className="h-3 w-3 shrink-0" /><span className="shrink-0">{product.category}</span><ChevronRight className="h-3 w-3 shrink-0" /><span className="truncate text-foreground">{product.name}</span></div>
      </div>

      <section className="container mx-auto grid gap-10 px-4 pb-12 md:grid-cols-2">
        <div>
          <div className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-black/80 sm:h-[360px] md:h-[420px]">
            <div className="absolute inset-0 -z-10 opacity-30 blur-3xl" style={{ background: 'var(--gradient-primary)' }} />
            {product.video && activeImg === -1 ? (
              <video ref={videoRef} key={product.video} src={getImageUrl(product.video)} controls className="h-full w-full object-contain" autoPlay muted playsInline
                onEnded={() => setActiveImg(0)}
              />
            ) : images.length > 0 ? (
              <img src={getImageUrl(images[safeActive])} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <img src="/primex-logo.jpeg" className="h-32 w-32 rounded-full opacity-50" />
            )}
            {totalSlides > 1 && (
              <>
                <button onClick={goLeft}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/80 transition">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={goRight}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/80 transition">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={`w-2 h-2 rounded-full transition ${i === activeImg ? 'bg-primary w-4' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
          {(images.length > 1 || product.video) && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {product.video && (
                <button onClick={() => setActiveImg(-1)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition flex items-center justify-center bg-black text-[9px] font-bold text-primary ${activeImg === -1 ? 'border-primary' : 'border-border opacity-60 hover:opacity-100'}`}>
                  ▶ Video
                </button>
              )}
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === activeImg ? 'border-primary' : 'border-border opacity-60 hover:opacity-100'}`}>
                  <img src={getImageUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary">{product.category}</div>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-foreground md:text-4xl">{product.name}</h1>
           <div className="mt-5 flex flex-wrap items-baseline gap-2 sm:gap-3">
            {product.salePrice && product.salePrice > 0 ? (
              <>
                <span className="font-display text-2xl font-black text-primary sm:text-4xl">{formatINR(product.salePrice)}</span>
                <span className="font-display text-lg font-black text-destructive line-through sm:text-2xl">{formatINR(product.price)}</span>
                <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">-{product.price > 0 && product.salePrice <= product.price ? Math.round((1 - product.salePrice / product.price) * 100) : 0}% OFF</span>
              </>
            ) : (
              <span className="font-display text-2xl font-black text-primary sm:text-4xl">{formatINR(product.price)}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

          <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${product.stock > 0 ? 'bg-primary/15 text-primary' : 'bg-destructive/20 text-destructive'}`}>
            {product.stock > 0 ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
          </div>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

          {product.specifications && product.specifications.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-display text-lg font-black text-foreground">Specifications</h3>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {product.specifications.map((spec, i) => (
                  <div key={i} className={`flex px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                    <span className="w-1/2 font-semibold text-foreground">{spec.name}</span>
                    <span className="w-1/2 text-muted-foreground">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.stock > 0 && (
             <div className="mt-7 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-display font-bold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Plus className="h-4 w-4" /></button>
              </div>
               <button onClick={handleAdd} className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 sm:px-6 sm:text-sm">
                {added ? <><Check className="h-4 w-4" /> Added to Cart</> : <><ShoppingCart className="h-4 w-4" /> Add to Cart</>}
              </button>
              <button onClick={handleWishlist} aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'} className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${wishlisted ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'}`}><Heart className={`h-5 w-5 ${wishlisted ? 'fill-primary' : ''}`} /></button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-6 text-xs">
            {[{ icon: Truck, t: 'Free shipping' }, { icon: Shield, t: 'Trusted Product / Reliable Product' }].map((b) => (
              <div key={b.t} className="flex items-center gap-2 text-muted-foreground"><b.icon className="h-4 w-4 text-primary" /><span>{b.t}</span></div>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container mx-auto px-4 pb-20">
          <h2 className="mb-6 font-display text-2xl font-black text-foreground">You might also like</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <Link key={p._id} to={`/product/${p._id}`} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-1 hover:border-primary">
                <div className="flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-surface to-background">
                  {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt={p.name} className="h-full w-full object-cover" /> : <MemoryStick className="h-16 w-16 text-primary/70" strokeWidth={1.2} />}
                </div>
                <div className="border-t border-border p-4">
                  <h3 className="font-display text-sm font-bold line-clamp-2 text-foreground">{p.name}</h3>
                  <div className="mt-2 space-y-0.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-muted-foreground">Selling Price</span>
                      <span className="font-display text-lg font-black text-green-500">{formatINR(p.salePrice || p.price)}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-muted-foreground">MRP</span>
                      <span className={`font-display text-sm text-red-500 ${p.salePrice && p.salePrice > 0 ? 'line-through' : ''}`}>{formatINR(p.price)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
