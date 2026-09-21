import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import api from '@/lib/api';
import type { Product } from '@/types';
import { formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';
import { Plus, Pencil, Trash2, Upload, X, Zap, RefreshCw, Search } from 'lucide-react';
import Pagination, { paginate, sortNewestFirst } from './Pagination';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<{ _id: string; name: string; parent?: { _id: string; name: string } | null; condition?: string }[]>([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'new' | 'refurbished'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [subCat, setSubCat] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [desc, setDesc] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [featured, setFeatured] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [dealEndsAt, setDealEndsAt] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [productCondition, setProductCondition] = useState('new');
  const [specifications, setSpecifications] = useState<{ name: string; value: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = () => {
    adminApi.getProducts().then(setProducts).catch(() => setProducts([]));
    api.get('/categories').then((r) => setAllCategories(r.data || [])).catch(() => setAllCategories([]));
  };

  const categories = allCategories.filter((c) => !c.parent);
  const productCats = allCategories.filter((c) => !c.parent && c.condition === productCondition);
  const productSubCats = allCategories.filter((c) => (c.parent?._id || c.parent?.name) && c.parent?.name === cat && c.condition === productCondition);

  useEffect(() => { load(); }, []);

  const filteredAll = sortNewestFirst(products.filter((p) => {
    if (activeCat !== 'all' && p.category !== activeCat) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${String(p.name)} ${String(p.description || '')} ${String(p.subCategory || '')} ${String(p.category || '')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (stockFilter === 'in' && Number(p.stock) <= 0) return false;
    if (stockFilter === 'out' && Number(p.stock) > 0) return false;
    if (conditionFilter !== 'all' && String(p.condition || 'new') !== conditionFilter) return false;
    return true;
  }));
  const filtered = paginate(filteredAll, page, perPage);
  useEffect(() => { setPage(1); }, [activeCat, search, stockFilter, conditionFilter]);

  const openNew = () => {
    setEditing(null); setName(''); setCat(productCats[0]?.name || ''); setSubCat(''); setPrice(''); setStock('0'); setDesc('');
    setImages([]); setExistingImages([]); setRemovedImages([]); setFeatured(false); setSalePrice(''); setDealEndsAt(''); setGstRate('18'); setProductCondition('new'); setSpecifications([]); setMsg(null); setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p); setName(p.name); setCat(p.category); setSubCat(p.subCategory || '');
    setPrice(String(p.price));
    setStock(String(p.stock)); setDesc(p.description); setImages([]);
    setExistingImages(p.images || []); setRemovedImages([]);
    setFeatured(p.featured || false); setSalePrice(p.salePrice ? String(p.salePrice) : '');
    setDealEndsAt(p.dealEndsAt ? new Date(p.dealEndsAt).toISOString().slice(0, 16) : '');
    setGstRate(String(p.gstRate || 18)); setProductCondition(p.condition || 'new');
    setSpecifications(p.specifications || []);
    setMsg(null); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await adminApi.deleteProduct(p._id); await load(); } catch { setMsg('Delete failed'); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setMsg('Enter name'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim()); fd.append('description', desc.trim());
      fd.append('price', price); fd.append('stock', stock || '0'); fd.append('category', cat);
      if (subCat) fd.append('subCategory', subCat);
      fd.append('featured', String(featured));
      if (salePrice) fd.append('salePrice', salePrice);
      if (dealEndsAt) fd.append('dealEndsAt', dealEndsAt);
      fd.append('gstRate', gstRate || '18');
      fd.append('condition', productCondition || 'new');
      fd.append('specifications', JSON.stringify(specifications));
      if (removedImages.length > 0) fd.append('removedImages', JSON.stringify(removedImages));
      images.forEach((f) => fd.append('images', f));
      if (videoFile) fd.append('images', videoFile);
      if (editing) {
        await adminApi.updateProduct(editing._id, fd);
      } else {
        await adminApi.createProduct(fd);
      }
      setShowModal(false); setEditing(null); await load();
    } catch (err: unknown) { setMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveCat('all')} className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${activeCat === 'all' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:border-primary'}`}>All</button>
          {categories.filter((c) => !(c as any).parent).map((c) => (
            <button key={c._id} onClick={() => setActiveCat(c.name)} className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${activeCat === c.name ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:border-primary'}`}>{c.name}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name / description..."
            className="h-10 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as 'all' | 'in' | 'out')} className="h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none">
          <option value="all">All Stock</option>
          <option value="in">In Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value as 'all' | 'new' | 'refurbished')} className="h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none">
          <option value="all">All Condition</option>
          <option value="new">New</option>
          <option value="refurbished">Refurbished</option>
        </select>
      </div>

      {filteredAll.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No products in this category.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p._id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                {p.images?.[0] ? <img src={getImageUrl(p.images[0])} alt="" className="h-full w-full object-cover" /> : <img src="/primex-logo.jpeg" className="h-8 w-8 rounded-full opacity-40" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''} · Stock: {p.stock}</div>
                <div className="text-xs mt-1"><span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${p.condition === 'refurbished' ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/15 text-primary'}`}>{p.condition === 'refurbished' ? 'Refurbished' : 'New'}</span></div>
                <div className="mt-1 flex items-baseline gap-2">
                  {p.salePrice && p.salePrice > 0 ? (
                    <><span className="font-display font-black text-primary">{formatINR(p.salePrice)}</span><span className="font-display font-black text-destructive line-through text-xs">{formatINR(p.price)}</span></>
                  ) : (
                    <span className="font-display font-black text-primary">{formatINR(p.price)}</span>
                  )}
                </div>
              </div>
              <button onClick={() => openEdit(p)} className="rounded-md border border-border p-2 hover:border-primary hover:text-primary"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(p)} className="rounded-md border border-border p-2 hover:border-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Pagination
        total={filteredAll.length}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={(n) => { setPerPage(n); setPage(1); }}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-black">{editing ? 'Edit Product' : 'New Product'}</h2>
              <button type="button" onClick={closeModal} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="Product name" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Condition</label>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => { setProductCondition('new'); setCat(''); setSubCat(''); }} className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${productCondition === 'new' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}><Zap className="h-3.5 w-3.5 inline -mt-0.5" /> New</button>
                  <button type="button" onClick={() => { setProductCondition('refurbished'); setCat(''); setSubCat(''); }} className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${productCondition === 'refurbished' ? 'bg-amber-500 text-white' : 'border border-border text-muted-foreground'}`}><RefreshCw className="h-3.5 w-3.5 inline -mt-0.5" /> Refurbished</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                <select value={cat} onChange={(e) => { setCat(e.target.value); setSubCat(''); }} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-2 text-sm" required>
                  <option value="">Select category</option>
                  {productCats.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subcategory</label>
                <select value={subCat} onChange={(e) => setSubCat(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-2 text-sm">
                  <option value="">None</option>
                  {productSubCats.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Original Price / MRP (₹)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" required />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stock</label>
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selling Price (₹)</label>
                  <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="Price you will sell at" />
                  {(() => {
                    const p = parseFloat(salePrice);
                    const r = parseFloat(gstRate);
                    if (!p || p <= 0 || !r) return null;
                    const base = p / (1 + r / 100);
                    const gst = p - base;
                    return (
                      <div className="mt-2 rounded-lg border border-border bg-surface/60 p-3 space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Price (excl. GST)</span><span className="font-semibold text-foreground">₹{base.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">GST @ {gstRate}%</span><span className="font-semibold text-primary">₹{gst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between border-t border-border pt-1"><span className="font-semibold text-foreground">Total (incl. GST)</span><span className="font-bold text-foreground">₹{p.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded border-border" />
                    Hot Deal
                  </label>
                </div>
              </div>
              {featured && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deal Ends At</label>
                  <input type="datetime-local" value={dealEndsAt} onChange={(e) => setDealEndsAt(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GST Rate</label>
                <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-2 text-sm">
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Specifications</label>
                <div className="mt-1 space-y-2">
                  {specifications.map((spec, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={spec.name} onChange={(e) => {
                        const s = [...specifications]; s[i] = { ...s[i], name: e.target.value }; setSpecifications(s);
                      }} placeholder="Name (e.g. Processor)" className="h-9 flex-1 rounded-md border border-border bg-input px-2 text-sm outline-none focus:border-primary" />
                      <input value={spec.value} onChange={(e) => {
                        const s = [...specifications]; s[i] = { ...s[i], value: e.target.value }; setSpecifications(s);
                      }} placeholder="Value (e.g. Intel i7 14700K)" className="h-9 flex-[2] rounded-md border border-border bg-input px-2 text-sm outline-none focus:border-primary" />
                      <button type="button" onClick={() => setSpecifications((prev) => prev.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setSpecifications((prev) => [...prev, { name: '', value: '' }])} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <Plus className="h-3.5 w-3.5" /> Add Specification
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Images (max 3)</label>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {existingImages.filter((img) => !removedImages.includes(img)).map((img, i) => (
                    <div key={`existing-${i}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border group">
                      <img src={getImageUrl(img)} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setRemovedImages((prev) => [...prev, img])} className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-[10px] opacity-0 group-hover:opacity-100 transition shadow"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  {images.map((file, i) => {
                    const blobUrl = URL.createObjectURL(file);
                    return (
                    <div key={`new-${i}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border group">
                      <img src={blobUrl} alt="" className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(blobUrl)} />
                      <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-[10px] opacity-0 group-hover:opacity-100 transition shadow"><X className="h-3 w-3" /></button>
                    </div>
                  );
                  })}
                  {(existingImages.filter((img) => !removedImages.includes(img)).length + images.length) < 3 && (
                    <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary transition">
                      <Plus className="h-5 w-5" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                        setImages((prev) => {
                          const all = [...prev, ...Array.from(e.target.files || [])];
                          const maxNew = 3 - existingImages.filter((img) => !removedImages.includes(img)).length;
                          return all.slice(0, Math.max(0, maxNew));
                        });
                      }} />
                    </label>
                  )}
                </div>
                {(existingImages.filter((img) => !removedImages.includes(img)).length + images.length) === 0 && (
                  <label className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground hover:border-primary">
                    Click here to upload images
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImages(Array.from(e.target.files || []).slice(0, 3))} />
                  </label>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Video (optional)</label>
                <label className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground hover:border-primary">
                  {videoFile ? videoFile.name : editing?.video ? 'Replace video' : 'Upload video (mp4)'}
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              {msg && <div className="rounded-md border border-border bg-surface/60 px-3 py-2 text-xs">{msg}</div>}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Add Product'}</button>
              <button type="button" onClick={closeModal} className="rounded-full border border-border px-4 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
