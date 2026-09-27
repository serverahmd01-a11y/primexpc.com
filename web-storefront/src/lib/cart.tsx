import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Product, CartItem } from '@/types';
import api from '@/lib/api';
import { addToCart as gaAddToCart, removeFromCart as gaRemoveFromCart } from '@/lib/analytics';

export const formatINR = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const getInclusivePrice = (price: number, gstRate?: number) =>
  Math.round(price * (1 + (gstRate || 18) / 100));

function getToken() {
  return localStorage.getItem('primex_token');
}

function isLoggedIn() {
  return !!getToken();
}

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (p: Product, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  refreshPrices: () => Promise<number | void>;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = 'primex_cart_v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const dedupeById = useCallback((list: CartItem[]): CartItem[] => {
    const byId = new Map<string, CartItem>();
    for (const i of list) {
      const key = String(i.productId || i.slug || '');
      if (!key) { byId.set(`raw-${Math.random()}`, i); continue; }
      const prev = byId.get(key);
      if (prev) byId.set(key, { ...i, qty: (prev.qty || 0) + (i.qty || 0) });
      else byId.set(key, i);
    }
    return Array.from(byId.values());
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        const clean = Array.isArray(parsed)
          ? parsed.filter((i) => i && typeof i.price === 'number' && Number.isFinite(i.price) && i.qty > 0)
          : [];
        setItems(dedupeById(clean));
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const toCartItem = (item: any): CartItem => {
    const id = String(item.product?._id || item.product || '');
    return {
      slug: id,
      productId: id,
      name: item.product?.name || item.name || '',
      brand: item.product?.category || '',
      price: item.product?.salePrice || item.product?.price || item.price || 0,
      priceLabel: formatINR(item.product?.salePrice || item.product?.price || item.price || 0),
      qty: item.quantity,
      gstRate: item.product?.gstRate || 18,
      image: item.product?.images?.[0] || '',
    };
  };

  const applyFreshPrices = useCallback((products: any[]): number | void => {
    if (!Array.isArray(products) || products.length === 0) return;
    const map = new Map(products.map((p: any) => [String(p._id), p]));
    const prev = itemsRef.current || [];
    let freshSubtotal = 0;
    const nextItems = prev.map((i) => {
      const p = map.get(String(i.productId || i.slug));
      const price = Number(p?.salePrice) || Number(p?.price) || i.price;
      freshSubtotal += i.qty * price;
      if (!p) return i;
      return {
        ...i,
        name: p.name || i.name,
        brand: p.category || i.brand,
        price,
        priceLabel: formatINR(price),
        gstRate: Number(p.gstRate) || i.gstRate,
        image: p.images?.[0] || i.image,
      };
    });
    setItems(nextItems);
    return freshSubtotal;
  }, []);

  const syncCart = useCallback((): Promise<number | void> => {
    if (!isLoggedIn()) return Promise.resolve();
    return api.get('/cart').then(({ data }) => {
      const serverItems = data?.cart?.items || [];
      if (serverItems.length === 0) {
        const local = itemsRef.current || [];
        for (const i of local) {
          api.post('/cart', { productId: i.productId || i.slug, quantity: i.qty }).catch(() => {});
        }
        return;
      }
      const mapped = serverItems.map(toCartItem);
      const serverKeys = new Set(mapped.map((m: CartItem) => String(m.productId || m.slug || '')));
      const extras = itemsRef.current.filter(
        (i) => !serverKeys.has(String(i.productId || i.slug || ''))
      );
      const merged = dedupeById([...mapped, ...extras]);
      setItems(merged);
      return merged.reduce((s: number, i: CartItem) => s + i.qty * (i.price || 0), 0);
    }).catch(() => {});
  }, [dedupeById]);

  const refreshPrices = useCallback((): Promise<number | void> => {
    const ids = itemsRef.current.map((i) => i.productId || i.slug).filter(Boolean);
    if (ids.length === 0) return Promise.resolve();
    if (isLoggedIn()) {
      return syncCart();
    }
    return api.get(`/products/cart-sync?ids=${encodeURIComponent(ids.join(','))}`)
      .then(({ data }) => applyFreshPrices(data.products || []))
      .catch(() => {});
  }, [syncCart, applyFreshPrices]);

  useEffect(() => {
    if (!hydrated) return;
    const syncOnActive = () => { if (isLoggedIn()) { syncCart(); } else { refreshPrices(); } };
    syncOnActive();
    window.addEventListener('focus', syncOnActive);
    return () => window.removeEventListener('focus', syncOnActive);
  }, [hydrated, syncCart, refreshPrices]);

  useEffect(() => {
    if (!hydrated) return;
    const onLogout = () => setItems([]);
    window.addEventListener('primex-logout', onLogout);
    return () => window.removeEventListener('primex-logout', onLogout);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, hydrated]);

  const add = useCallback((p: Product, qty = 1) => {
    gaAddToCart({ id: p._id, name: p.name, price: p.salePrice || p.price, category: p.category, quantity: qty });
    const prev = itemsRef.current;
    const existing = prev.find((i) => i.slug === p._id);
    const next = existing
      ? prev.map((i) => i.slug === p._id ? { ...i, qty: i.qty + qty } : i)
      : [...prev, {
          slug: p._id,
          productId: p._id,
          name: p.name,
          brand: p.category,
          price: p.salePrice || p.price,
          priceLabel: formatINR(p.salePrice || p.price),
          qty,
          gstRate: p.gstRate || 18,
          image: p.images?.[0] || '',
        }];
    itemsRef.current = next;
    setItems(next);
    if (isLoggedIn()) {
      api.post('/cart', { productId: p._id, quantity: qty }).catch(() => {});
    }
    setOpen(true);
    refreshPrices();
  }, [refreshPrices]);

  const remove = useCallback((slug: string) => {
    const prev = itemsRef.current;
    const item = prev.find((i) => i.slug === slug);
    if (item) {
      gaRemoveFromCart({ id: item.productId || item.slug, name: item.name, price: item.price, category: item.brand, quantity: item.qty });
    }
    const next = prev.filter((i) => i.slug !== slug);
    itemsRef.current = next;
    setItems(next);
    if (isLoggedIn()) {
      api.delete(`/cart/${slug}`).catch(() => {});
    }
  }, []);

  const setQty = useCallback((slug: string, qty: number) => {
    const prev = itemsRef.current;
    const next = qty <= 0
      ? prev.filter((i) => i.slug !== slug)
      : prev.map((i) => i.slug === slug ? { ...i, qty } : i);
    itemsRef.current = next;
    setItems(next);
    if (isLoggedIn()) {
      if (qty <= 0) {
        api.delete(`/cart/${slug}`).catch(() => {});
      } else {
        api.put(`/cart/${slug}`, { quantity: qty }).catch(() => {});
      }
    }
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    if (isLoggedIn()) {
      api.delete('/cart').catch(() => {});
    }
  }, []);

  const value = useMemo<CartCtx>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    return {
      items, count, subtotal, isOpen,
      open: () => { refreshPrices(); setOpen(true); },
      close: () => setOpen(false),
      add, remove, setQty, clear, refreshPrices,
    };
  }, [items, isOpen, add, remove, setQty, clear, refreshPrices]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
