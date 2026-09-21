import { Link } from 'react-router-dom';
import { useState, useEffect, Fragment } from 'react';
import { Cpu, Fan, CircuitBoard, MemoryStick, HardDrive, MonitorSmartphone, Power, Box, Monitor, Keyboard, Headphones, Laptop, ChevronDown, ChevronRight, CheckSquare, Square, X, Filter, Package, Star, ShoppingCart, Zap, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';
import type { Product } from '@/types';

const catIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Processor: Cpu, 'CPU Cooler': Fan, Motherboard: CircuitBoard, RAM: MemoryStick,
  GPU: MonitorSmartphone, Storage: HardDrive, PSU: Power, Case: Box,
  Monitor: Monitor, Peripherals: Keyboard, Accessories: Headphones, Laptop: Laptop,
};

type CatNode = { _id: string; name: string; description?: string; image?: string; parent?: { _id: string; name: string } | null };

export default function AllCategories() {
  const [categories, setCategories] = useState<CatNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState(() => localStorage.getItem('primex_condition') || 'refurbished');
  const { add } = useCart();
  const [visibleCount, setVisibleCount] = useState(16);

  useEffect(() => {
    Promise.all([
      api.get('/categories', { params: { condition } }).then(({ data }) => setCategories(Array.isArray(data) ? data : [])).catch(() => {}),
      api.get('/products').then(({ data }) => setProducts(Array.isArray(data) ? data : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [condition]);

  const mainCats = categories.filter((c) => !c.parent);
  const getSubs = (pid: string) => categories.filter((c) => c.parent?._id === pid);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    const allIds = new Set(categories.map((c) => c._id));
    setSelectedIds(selectedIds.size === allIds.size ? new Set() : allIds);
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedCats = categories.filter((c) => selectedIds.has(c._id));
  const selectedNames = new Set(selectedCats.map((c) => c.name));

  const filteredCats = mainCats;

  const filteredProducts = products.filter((p) => {
    if (selectedIds.size === 0) return false;
    return selectedNames.has(p.category) || selectedNames.has(p.subCategory || '');
  });

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  const handleAdd = (p: Product) => { add(p); setAddedIds((prev) => new Set(prev).add(p._id)); setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(p._id); return n; }), 1500); };

  return (
    <div>
      <div className="border-b border-border bg-surface/50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="font-display text-3xl font-black">All Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mainCats.length} main · {categories.length - mainCats.length} sub · {products.length} products</p>
          <div className="mt-3 flex gap-2 sm:gap-4">
            <button onClick={() => { setCondition('new'); localStorage.setItem('primex_condition', 'new'); }} className={`flex-1 rounded-full px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition ${condition === 'new' ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'border border-border text-muted-foreground hover:border-primary'}`}><Zap className="h-4 w-4 inline -mt-0.5" /> New</button>
            <button onClick={() => { setCondition('refurbished'); localStorage.setItem('primex_condition', 'refurbished'); }} className={`flex-1 rounded-full px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition ${condition === 'refurbished' ? 'bg-amber-500 text-white shadow-[var(--shadow-glow)]' : 'border border-border text-muted-foreground hover:border-primary'}`}><RefreshCw className="h-4 w-4 inline -mt-0.5" /> Refurbished</button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">

        {/* Selection Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-primary">{selectedIds.size} selected · {filteredProducts.length} products</span>
            <div className="flex-1 flex gap-1.5 flex-wrap">
              {selectedCats.map((c) => (
                <span key={c._id} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {c.parent ? `${c.parent.name} > ` : ''}{c.name}
                  <button onClick={() => toggleSelect(c._id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-destructive shrink-0">Clear all</button>
          </div>
        )}

        {/* Category Table */}
        <div className="mb-8 overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="w-10 px-4 py-3" />
                <th className="px-0 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Subs</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">Browse</th>
              </tr>
            </thead>
            <tbody>
              {filteredCats.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">No categories found</td></tr>
              ) : filteredCats.map((cat) => {
                const subs = getSubs(cat._id);
                const isExpanded = expanded[cat._id];
                const isSelected = selectedIds.has(cat._id);
                const Icon = catIcons[cat.name] || Box;

                return (
                  <Fragment key={cat._id}>
                    <tr key={cat._id} className={`border-b border-border/50 transition ${isSelected ? 'bg-primary/5' : 'hover:bg-surface/30'}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(cat._id)} className="rounded p-0.5">
                          {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </td>
                      <td className="px-0 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setExpanded({ ...expanded, [cat._id]: !isExpanded })} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                            {subs.length > 0 ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4 inline-block" />}
                          </button>
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-sm font-bold">{cat.name}</span>
                            {cat.description && <p className="text-[11px] text-muted-foreground truncate max-w-48">{cat.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground">{subs.length}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link to={`/category/${encodeURIComponent(cat.name)}`} className="rounded-lg bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition">
                          View All
                        </Link>
                      </td>
                    </tr>

                    {isExpanded && subs.map((sub) => {
                      const subSelected = selectedIds.has(sub._id);
                      return (
                        <tr key={sub._id} className={`border-b border-border/30 transition ${subSelected ? 'bg-primary/5' : 'hover:bg-surface/20'}`}>
                          <td className="px-4 py-2.5">
                            <button onClick={() => toggleSelect(sub._id)} className="rounded p-0.5 ml-6">
                              {subSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                            </button>
                          </td>
                          <td className="px-0 py-2.5">
                            <div className="flex items-center gap-3 ml-4">
                              <span className="border-l-2 border-primary/30 pl-3 inline-block w-4" />
                              <span className="text-sm">{sub.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-[10px] text-muted-foreground">—</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link to={`/category/${encodeURIComponent(cat.name)}?sub=${encodeURIComponent(sub.name)}`} className="rounded-lg border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary hover:text-primary transition">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button onClick={toggleSelectAll} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
            {selectedIds.size === categories.length ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
            {selectedIds.size === categories.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-muted-foreground">{selectedIds.size}/{categories.length} selected</span>
        </div>

        {/* Filtered Products */}
        {selectedIds.size > 0 && (
          <div>
            <h2 className="font-display text-xl font-black mb-4">
              Products ({filteredProducts.length})
              {selectedCats.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">in {selectedCats.map(c => c.parent ? `${c.parent.name} > ${c.name}` : c.name).join(', ')}</span>}
            </h2>
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <Package className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">No products found in selected categories.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {visibleProducts.map((p) => {
                  const Icon2 = catIcons[p.category] || Package;
                  const added = addedIds.has(p._id);
                  return (
                    <Link key={p._id} to={`/product/${p._id}`} className="group flex flex-col rounded-xl border border-border bg-card p-3 transition hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-glow)]">
                      <div className="flex h-28 items-center justify-center rounded-lg bg-gradient-to-br from-surface to-background mb-2 overflow-hidden">
                        {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt={p.name} className="h-full w-full object-cover" /> : <div className="text-primary/40"><Icon2 className="h-12 w-12" /></div>}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-primary">{p.category}</div>
                      {p.subCategory && <div className="text-[9px] text-muted-foreground">{p.subCategory}</div>}
                      <h3 className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug group-hover:text-primary transition">{p.name}</h3>
                      {p.averageRating > 0 && <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {p.averageRating.toFixed(1)}</div>}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div>
                          {p.salePrice && p.salePrice > 0 ? (
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <div className="font-display text-base font-black text-primary">{formatINR(p.salePrice)}</div>
                              <div className="font-display text-base font-black text-destructive line-through">{formatINR(p.price)}</div>
                            </div>
                          ) : (
                            <div className="font-display text-base font-black text-primary">{formatINR(p.price)}</div>
                          )}
                        </div>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(p); }} className={`flex h-8 w-8 items-center justify-center rounded-full transition ${added ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}`}><ShoppingCart className="h-3.5 w-3.5" /></button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {visibleCount < filteredProducts.length && (
              <div className="mt-8 flex justify-center">
                <button onClick={() => setVisibleCount((c) => c + 16)} className="rounded-xl border border-primary bg-primary/10 px-8 py-3 text-sm font-bold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-glow)]">
                  Load More ({filteredProducts.length - visibleCount} left)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
