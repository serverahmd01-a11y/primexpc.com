import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';

type SitemapItem = { name: string; slug?: string; type: string };
type CatNode = { _id: string; name: string };

export default function Sitemap() {
  const [products, setProducts] = useState<SitemapItem[]>([]);
  const [categories, setCategories] = useState<CatNode[]>([]);
  const [pages, setPages] = useState<SitemapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/products').then((r) => setProducts((r.data || []).map((p: any) => ({ name: p.name, slug: p._id, type: 'product' })))),
      api.get('/categories').then((r) => setCategories(r.data || [])),
      api.get('/pages/public').then((r) => setPages((r.data || []).map((p: any) => ({ name: p.title, slug: p.slug, type: 'page' })))),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="border-b border-border bg-surface/50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="font-display text-3xl font-black">Sitemap</h1>
          <p className="mt-1 text-sm text-muted-foreground">Complete list of all pages on PrimeX PC</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold text-primary uppercase tracking-wider mb-4">Pages</h2>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-muted-foreground hover:text-primary">Home</Link></li>
              <li><Link to="/categories" className="text-sm text-muted-foreground hover:text-primary">All Categories</Link></li>
              <li><Link to="/cart" className="text-sm text-muted-foreground hover:text-primary">Shopping Cart</Link></li>
              <li><Link to="/profile" className="text-sm text-muted-foreground hover:text-primary">My Account</Link></li>
              <li><Link to="/orders" className="text-sm text-muted-foreground hover:text-primary">Order History</Link></li>
              {pages.map((p) => (
                <li key={p.slug}><Link to={`/page/${p.slug}`} className="text-sm text-muted-foreground hover:text-primary">{p.name}</Link></li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold text-primary uppercase tracking-wider mb-4">Categories</h2>
            <ul className="space-y-2">
              {categories.filter((c: any) => !c.parent).map((c: any) => (
                <li key={c._id}>
                  <Link to={`/category/${encodeURIComponent(c.name)}`} className="text-sm text-muted-foreground hover:text-primary font-semibold">{c.name}</Link>
                  {categories.filter((s: any) => s.parent?._id === c._id || s.parent?.name === c.name).length > 0 && (
                    <ul className="ml-3 mt-1 space-y-1">
                      {categories.filter((s: any) => s.parent?._id === c._id || s.parent?.name === c.name).map((s: any) => (
                        <li key={s._id}><Link to={`/category/${encodeURIComponent(c.name)}`} className="text-xs text-muted-foreground hover:text-primary">{s.name}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold text-primary uppercase tracking-wider mb-4">Products ({products.length})</h2>
            <ul className="space-y-2 max-h-[500px] overflow-y-auto">
              {products.map((p) => (
                <li key={p.slug}><Link to={`/product/${p.slug}`} className="text-sm text-muted-foreground hover:text-primary line-clamp-1">{p.name}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
