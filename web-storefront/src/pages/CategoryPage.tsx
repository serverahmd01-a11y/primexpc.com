import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { SlidersHorizontal, X, ChevronDown, ChevronRight, Package, ShoppingCart, Star, Cpu, Fan, CircuitBoard, MemoryStick, HardDrive, MonitorSmartphone, Power, Box, Monitor, Keyboard, Headphones, Laptop, CheckSquare, Square } from 'lucide-react';
import { fetchProducts } from '@/data/products';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import type { Product } from '@/types';
import { ProductCardSkeleton } from '@/components/Skeleton';

const catIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Processor: Cpu, 'CPU Cooler': Fan, Motherboard: CircuitBoard, RAM: MemoryStick,
  GPU: MonitorSmartphone, Storage: HardDrive, PSU: Power, Case: Box,
  Monitor: Monitor, Peripherals: Keyboard, Accessories: Headphones, Laptop: Laptop,
};

type CatNode = { _id: string; name: string; parent?: { _id: string; name: string } | null };

export default function CategoryPage() {
  const { categoryName } = useParams<{ categoryName: string }>();
  const [searchParams] = useSearchParams();
  const { add } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [allCats, setAllCats] = useState<CatNode[]>([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sort, setSort] = useState('default');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
  const [showFilters, setShowFilters] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(16);
  const [loading, setLoading] = useState(true);
  const urlCond = searchParams.get('condition');
  const condition = urlCond || localStorage.getItem('primex_condition') || 'refurbished';

  useEffect(() => {
    if (urlCond) localStorage.setItem('primex_condition', urlCond);
    setSearch('');
    setSort('default');
    setPriceRange([0, 500000]);
    setSelectedCatIds(new Set());
  }, [urlCond]);
  useEffect(() => {
    Promise.all([
      fetchProducts().then(setProducts),
      api.get('/categories', { params: { condition } }).then(({ data }) => setAllCats(Array.isArray(data) ? data : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [condition]);
  useEffect(() => { setVisibleCount(16); }, [search, condition, selectedCatIds, sort, priceRange, categoryName]);

  const mainCats = allCats.filter((c) => !c.parent);
  const currentMain = categoryName && categoryName !== 'all' ? categoryName : null;
  const getSubs = (pid: string) => allCats.filter((c) => c.parent?._id === pid);

  const toggleCat = (id: string) => {
    setSelectedCatIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectedCats = allCats.filter((c) => selectedCatIds.has(c._id));
  const selectedCatNames = new Set(selectedCats.map((c) => c.name));

  const filtered = useMemo(() => {
    let result = [...products];
    if (categoryName && categoryName !== 'all') result = result.filter((p) => p.category === categoryName);
    if (selectedCatIds.size > 0) {
      result = result.filter((p) => selectedCatNames.has(p.category) || selectedCatNames.has(p.subCategory || ''));
    }
    if (condition) result = result.filter((p) => p.condition === condition);
    if (search) { const q = search.toLowerCase(); result = result.filter((p) => p.name.toLowerCase().includes(q)); }
    const eff = (p: Product) => p.salePrice || p.price;
    result = result.filter((p) => eff(p) >= priceRange[0] && eff(p) <= priceRange[1]);
    if (sort === 'price-asc') result.sort((a, b) => eff(a) - eff(b));
    else if (sort === 'price-desc') result.sort((a, b) => eff(b) - eff(a));
    else if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'rating') result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    return result;
  }, [products, categoryName, search, sort, priceRange, selectedCatIds, condition]);

  const paginated = filtered.slice(0, visibleCount);

  const handleAdd = (p: Product) => { add(p); setAddedIds((prev) => new Set(prev).add(p._id)); setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(p._id); return n; }), 1500); };

  const prices = products.map((p) => p.salePrice || p.price);
  const minPrice = Math.min(...prices, 0);
  const maxPrice = Math.max(...prices, 500000);

  const categoryTitle = categoryName === 'all' ? 'All Products' : currentMain || '';
  const Icon = currentMain ? (catIcons[currentMain] || Box) : Package;

  return (
    <div>
      <div className="border-b border-border bg-surface/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-primary">Products</div>
              <h1 className="font-display text-2xl font-black md:text-3xl">{categoryTitle}</h1>
              <p className="text-sm text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? 's' : ''} found</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div />
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-primary transition lg:hidden"><SlidersHorizontal className="h-4 w-4" /> Filters</button>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 rounded-xl border border-border bg-card pl-4 pr-10 text-sm font-semibold outline-none transition focus:border-primary cursor-pointer">
              <option value="default">Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name A-Z</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {/* Selected Categories Bar */}
        {selectedCatIds.size > 0 && (
          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-primary shrink-0">{selectedCatIds.size} selected · {filtered.length} results</span>
            <div className="flex-1 flex gap-1.5 flex-wrap">
              {selectedCats.map((c) => (
                <span key={c._id} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {c.parent ? `${c.parent.name} > ` : ''}{c.name}
                  <button onClick={() => toggleCat(c._id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <button onClick={() => setSelectedCatIds(new Set())} className="text-xs text-muted-foreground hover:text-destructive shrink-0">Clear all</button>
          </div>
        )}

        <div className="mt-6 flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Mobile filter overlay */}
          {showFilters && (
            <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowFilters(false)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute inset-y-0 left-0 w-72 bg-background overflow-y-auto p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Filters</h3>
                  <button onClick={() => setShowFilters(false)} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>
                <FilterContent mainCats={mainCats} allCats={allCats} catIcons={catIcons} currentMain={currentMain} expandedCats={expandedCats} setExpandedCats={setExpandedCats} selectedCatIds={selectedCatIds} toggleCat={toggleCat} getSubs={getSubs} minPrice={minPrice} maxPrice={maxPrice} priceRange={priceRange} setPriceRange={setPriceRange} condition={condition} />
              </div>
            </div>
          )}

          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:w-64 lg:shrink-0 space-y-6">
            <FilterContent mainCats={mainCats} allCats={allCats} catIcons={catIcons} currentMain={currentMain} expandedCats={expandedCats} setExpandedCats={setExpandedCats} selectedCatIds={selectedCatIds} toggleCat={toggleCat} getSubs={getSubs} minPrice={minPrice} maxPrice={maxPrice} priceRange={priceRange} setPriceRange={setPriceRange} condition={condition} />
          </aside>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 overflow-x-hidden">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
                <Package className="h-16 w-16 text-muted-foreground/30" />
                <h3 className="mt-4 font-display text-xl font-bold">No products found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                <button onClick={() => { setSearch(''); setPriceRange([minPrice, maxPrice]); setSort('default'); setSelectedCatIds(new Set()); }} className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 transition">Clear All Filters</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 overflow-x-hidden">
                  {paginated.map((p) => {
                    const Icon2 = catIcons[p.category] || Package;
                    const added = addedIds.has(p._id);
                    return (
                      <Link key={p._id} to={`/product/${p._id}`} className="group flex flex-col rounded-xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-glow)]">
                        <div className="flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-surface to-background mb-3 overflow-hidden">
                          {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt={p.name} className="h-full w-full object-cover" /> : <div className="text-primary/40"><Icon2 className="h-14 w-14" /></div>}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{p.category}</div>
                        {p.subCategory && <div className="text-[10px] text-muted-foreground">{p.subCategory}</div>}
                        <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary transition">{p.name}</h3>
                        {p.averageRating > 0 && <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {p.averageRating.toFixed(1)} ({p.totalReviews})</div>}
                        <div className="mt-auto flex items-center justify-between pt-3">
                          <div>
                            {p.salePrice && p.salePrice > 0 ? (
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <div className="font-display text-lg font-black text-primary">{formatINR(p.salePrice)}</div>
                                <div className="font-display text-lg font-black text-destructive line-through">{formatINR(p.price)}</div>
                              </div>
                            ) : (
                              <div className="font-display text-lg font-black text-primary">{formatINR(p.price)}</div>
                            )}
                          </div>
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(p); }} className={`flex h-9 w-9 items-center justify-center rounded-full transition ${added ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}`}><ShoppingCart className="h-4 w-4" /></button>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                  {visibleCount < filtered.length && (
                  <div className="mt-8 flex justify-center">
                    <button onClick={() => setVisibleCount((c) => c + 16)} className="rounded-xl border border-primary bg-primary/10 px-8 py-3 text-sm font-bold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-glow)]">
                      Load More ({filtered.length - visibleCount} left)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterContent({ mainCats, allCats, catIcons, currentMain, expandedCats, setExpandedCats, selectedCatIds, toggleCat, getSubs, minPrice, maxPrice, priceRange, setPriceRange, condition }: any) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Categories</h3>

        <Link to={`/category/all?condition=${condition}`} className={`block rounded-lg px-3 py-2 text-sm mb-2 transition ${!currentMain ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-accent/10'}`}>
          All Products
        </Link>

        <div className="space-y-0.5">
          {mainCats.map((cat: any) => {
            const subs = getSubs(cat._id);
            const isExpanded = expandedCats[cat._id];
            const isSelected = selectedCatIds.has(cat._id);
            const isActive = currentMain === cat.name;

            return (
              <Fragment key={cat._id}>
                <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${isActive ? 'bg-primary/5' : ''}`}>
                  <button onClick={() => toggleCat(cat._id)} className="rounded p-0.5 shrink-0">
                    {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  <Link to={`/category/${encodeURIComponent(cat.name)}?condition=${condition}`} className="flex items-center gap-2 flex-1 min-w-0 text-sm text-muted-foreground hover:text-foreground transition">
                    {catIcons[cat.name] ? <IconComp icon={catIcons[cat.name]} /> : <Box className="h-4 w-4 shrink-0" />}
                    <span className={`truncate ${isActive ? 'text-primary font-semibold' : ''}`}>{cat.name}</span>
                  </Link>

                  {subs.length > 0 && (
                    <button onClick={() => setExpandedCats({ ...expandedCats, [cat._id]: !isExpanded })} className="rounded p-0.5 text-muted-foreground hover:text-foreground shrink-0">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>

                {isExpanded && subs.length > 0 && (
                  <div className="ml-7 space-y-0.5 border-l-2 border-primary/15 pl-3">
                    {subs.map((sub: any) => {
                      const subSelected = selectedCatIds.has(sub._id);
                      return (
                        <label key={sub._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-accent/10 text-sm transition">
                          <button onClick={() => toggleCat(sub._id)} className="rounded p-0.5">
                            {subSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                          <span className={`flex-1 ${subSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{sub.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider">Price Range</h3>
        <div className="mt-4 space-y-3">
          <input type="range" min={minPrice} max={maxPrice} step={1000} value={priceRange[1]} onChange={(e: any) => setPriceRange([priceRange[0], Number(e.target.value)])} className="w-full accent-primary" />
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{formatINR(priceRange[0])}</span><span>{formatINR(priceRange[1])}</span></div>
          <button onClick={() => setPriceRange([minPrice, maxPrice])} className="text-xs text-primary hover:underline">Reset</button>
        </div>
      </div>
    </div>
  );
}

function IconComp({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return <Icon className="h-4 w-4" />;
}
