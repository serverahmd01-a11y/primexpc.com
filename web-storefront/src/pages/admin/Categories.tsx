import { useEffect, useState, useCallback, Fragment } from 'react';
import api from '@/lib/api';
import { adminApi } from '@/lib/api';
import type { Product } from '@/types';
import { Tag, Plus, Trash2, Edit3, X, ChevronDown, ChevronRight, Upload, Zap, RefreshCw } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

interface CatNode {
  _id: string; name: string; description?: string; image?: string; condition?: string;
  parent?: { _id: string; name: string } | null;
}

export default function AdminCategories() {
  const [allCategories, setAllCategories] = useState<CatNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ name: '', parent: '', description: '', image: null as File | null, condition: 'new' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeCond, setActiveCond] = useState<'new' | 'refurbished'>('new');

  const load = useCallback(async (cond: string) => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories', { params: { condition: cond } }),
        adminApi.getProducts(),
      ]);
      setAllCategories(catRes.data || []);
      setProducts(prodRes || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(activeCond); }, [load, activeCond]);

  const categories = allCategories.filter((c) => c.condition === activeCond);
  const mainCats = categories.filter((c) => !c.parent);
  const getSubs = (pid: string) => categories.filter((c) => c.parent?._id === pid);
  const getCount = (name: string) => products.filter((p) => p.category === name && p.condition === activeCond).length;
  const getSubCount = (name: string) => products.filter((p) => p.subCategory === name && p.condition === activeCond).length;

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', parent: '', description: '', image: null, condition: activeCond });
    setImagePreview(null);
    setShowForm(true);
  };

  const openEdit = (cat: CatNode) => {
    setEditId(cat._id);
    setForm({ name: cat.name, parent: cat.parent?._id || '', description: cat.description || '', image: null, condition: cat.condition || 'new' });
    setImagePreview(cat.image ? API_BASE + cat.image : null);
    setShowForm(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setForm({ ...form, image: file });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const fd = new FormData();
    fd.append('name', form.name.trim());
    if (form.parent) fd.append('parent', form.parent);
    if (form.description) fd.append('description', form.description);
    if (form.condition) fd.append('condition', form.condition);
    if (form.image) fd.append('image', form.image);

    try {
      if (editId) await api.put(`/admin/categories/${editId}`, fd);
      else await api.post('/admin/categories', fd);
      setShowForm(false); setMsg(null); await load(activeCond);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMsg(e?.response?.data?.error || 'Failed to save');
      setMsgType('error');
    }
  };

  const remove = async (c: CatNode) => {
    const count = c.parent ? getSubCount(c.name) : getCount(c.name);
    if (count > 0 && !confirm(`${count} product(s) in "${c.name}". Delete anyway?`)) return;
    try { await api.delete(`/admin/categories/${c._id}`); await load(activeCond); }
    catch { setMsg('Failed to delete'); setMsgType('error'); }
  };

  const seed = async (condition: string) => {
    try { await api.post(`/admin/categories/seed?condition=${condition}`); await load(activeCond); setMsg(`${condition} categories seeded!`); setMsgType('success'); }
    catch { setMsg('Failed'); setMsgType('error'); }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-black">Categories</h2>
          <p className="text-sm text-muted-foreground mt-1">{mainCats.length} main · {categories.length - mainCats.length} sub · {products.filter((p) => p.condition === activeCond).length} {activeCond} products</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => seed(activeCond)} className="text-xs text-muted-foreground hover:text-primary underline">Seed {activeCond === 'new' ? 'New' : 'Refurbished'} Categories</button>
          <button onClick={openNew} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Add</button>
        </div>
      </div>

      {msg && (
        <div className={'rounded-lg px-3 py-2 text-xs ' + (msgType === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
          {msg}
        </div>
      )}

      {/* Condition Tabs */}
      <div className="flex gap-2">
        <button onClick={() => { setActiveCond('new'); setExpanded({}); }} className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${activeCond === 'new' ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'border border-border text-muted-foreground hover:border-primary'}`}>
          <Zap className="h-3.5 w-3.5 inline -mt-0.5" /> New
        </button>
        <button onClick={() => { setActiveCond('refurbished'); setExpanded({}); }} className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${activeCond === 'refurbished' ? 'bg-amber-500 text-white shadow-[var(--shadow-glow)]' : 'border border-border text-muted-foreground hover:border-primary'}`}>
          <RefreshCw className="h-3.5 w-3.5 inline -mt-0.5" /> Refurbished
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-full p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Condition</label>
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary">
                  <option value="new">New Only</option>
                  <option value="refurbished">Refurbished Only</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Category name" className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parent Category</label>
                <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary">
                  <option value="">None (Main Category)</option>
                  {mainCats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Category description..." className="mt-1 h-20 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Image</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary transition">
                    <Upload className="h-4 w-4" /> {form.image ? form.image.name : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                  </label>
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
                      <button type="button" onClick={() => { setForm({ ...form, image: null }); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-background rounded-full border border-border p-0.5"><X className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground">{editId ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              <th className="px-0 py-3 pl-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-16">Condition</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Products</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-16">Subs</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mainCats.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No categories for {activeCond}. Click "Seed Defaults" or add manually.</td></tr>
            ) : mainCats.map((cat) => {
              const subs = getSubs(cat._id);
              const isExpanded = expanded[cat._id];

              return (
                <Fragment key={cat._id}>
                  <tr className="border-b border-border/50 hover:bg-surface/30 transition">
                    <td className="px-4 py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setExpanded({ ...expanded, [cat._id]: !isExpanded })} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          {subs.length > 0 ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4 inline-block" />}
                        </button>
                        {cat.image && <img src={API_BASE + cat.image} alt="" className="h-7 w-7 rounded object-cover" />}
                        <div>
                          <span className="text-sm font-bold">{cat.name}</span>
                          {cat.description && <p className="text-[11px] text-muted-foreground truncate max-w-48">{cat.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${cat.condition === 'refurbished' ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/15 text-primary'}`}>
                        {cat.condition === 'refurbished' ? 'Refurb' : 'New'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{getCount(cat.name)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted-foreground">{subs.length}</span>
                    </td>
                    <td className="px-4 py-3 text-center pr-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(cat)} className="rounded p-1 text-muted-foreground hover:text-primary"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(cat)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && subs.map((sub) => (
                    <tr key={sub._id} className="border-b border-border/30 hover:bg-surface/20 transition">
                      <td className="px-4 py-2.5 pl-4">
                        <div className="flex items-center gap-3 pl-8">
                          <span className="border-l-2 border-primary/30 pl-3 inline-block w-4" />
                          {sub.image && <img src={API_BASE + sub.image} alt="" className="h-6 w-6 rounded object-cover" />}
                          <div>
                            <span className="text-sm">{sub.name}</span>
                            {sub.description && <p className="text-[11px] text-muted-foreground truncate max-w-48">{sub.description}</p>}
                          </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${sub.condition === 'refurbished' ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/15 text-primary'}`}>
                        {sub.condition === 'refurbished' ? 'Refurb' : 'New'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="rounded bg-muted/30 px-2 py-0.5 text-[11px]">{getSubCount(sub.name)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-[10px] text-muted-foreground">—</span>
                      </td>
                      <td className="px-4 py-2.5 text-center pr-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(sub)} className="rounded p-1 text-muted-foreground hover:text-primary"><Edit3 className="h-3 w-3" /></button>
                          <button onClick={() => remove(sub)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
