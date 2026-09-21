import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Check, ImageOff, Loader2, Search, Package } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getImageUrl } from '@/lib/utils';
import type { Product } from '@/types';

export default function AdminStock() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getProducts()
      .then((items) => {
        const list = (items || []) as Product[];
        setProducts(list);
        setValues(Object.fromEntries(list.map((p) => [p._id, String(p.stock ?? 0)])));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (!isAdmin) return <Navigate to="/admin" replace />;

  const filtered = products.filter((product) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${product.name} ${product.category} ${product.subCategory || ''}`.toLowerCase().includes(query);
  });

  const saveStock = async (product: Product) => {
    const raw = (values[product._id] ?? '').trim();
    if (raw === '') return;
    const nextStock = Number(raw);
    if (!Number.isInteger(nextStock) || nextStock < 0) return;

    setSaving(product._id);
    try {
      const result = await adminApi.updateProductStock(product._id, nextStock);
      const updated = result.product as Product;
      setProducts((current) => current.map((item) => item._id === product._id ? { ...item, stock: updated.stock } : item));
      setValues((current) => ({ ...current, [product._id]: String(updated.stock) }));
      setSaved(product._id);
      window.setTimeout(() => setSaved((current) => current === product._id ? null : current), 1400);
    } catch {
      setSaved(null);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-black">Quick Stock Update</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter a number and press Enter. The product page and storefront update immediately.</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product, category..."
          className="h-11 w-full rounded-lg border border-border bg-input pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((product) => (
            <div key={product._id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                  {product.images?.[0] ? <img src={getImageUrl(product.images[0])} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{product.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{product.category}{product.subCategory ? ` - ${product.subCategory}` : ''}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Package className="h-3 w-3" /> Current: {product.stock}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:w-56 sm:justify-end">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values[product._id] ?? String(product.stock)}
                  onChange={(event) => setValues((current) => ({ ...current, [product._id]: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveStock(product); } }}
                  aria-label={`Stock for ${product.name}`}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-input px-3 text-sm font-bold outline-none focus:border-primary sm:w-24 sm:flex-none"
                />
                <span className="hidden text-[10px] text-muted-foreground sm:block">Press Enter</span>
                {saving === product._id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : saved === product._id ? <Check className="h-5 w-5 text-emerald-400" /> : null}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No products found.</div>}
        </div>
      )}
    </div>
  );
}
