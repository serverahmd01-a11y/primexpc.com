import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Image, ChevronLeft, Upload, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

type SellCategory = { _id: string; name: string; icon: string; image: string; description: string; active: boolean; sortOrder: number };
type SellBrand = { _id: string; name: string; category: { _id: string; name: string }; active: boolean; sortOrder: number };
type SellModel = { _id: string; name: string; brand: { _id: string; name: string; category?: { _id: string; name: string } }; active: boolean; sortOrder: number };

const TABS = [
  { key: 'categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'models', label: 'Models' },
];

const ICON_OPTIONS = [
  'MonitorSmartphone', 'Laptop', 'Monitor', 'Cpu', 'CircuitBoard',
  'MemoryStick', 'Disc', 'HardDrive', 'Power', 'Server', 'Network', 'Box',
];

export default function SellProducts() {
  const [tab, setTab] = useState('categories');
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<SellCategory[]>([]);
  const [brands, setBrands] = useState<SellBrand[]>([]);
  const [models, setModels] = useState<SellModel[]>([]);

  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', icon: 'Box', description: '', active: true, sortOrder: 0 });
  const [formCategory, setFormCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cats, brs, mds] = await Promise.all([
        api.get('/admin/sell/categories').then((r) => r.data),
        api.get('/admin/sell/brands').then((r) => r.data),
        api.get('/admin/sell/models').then((r) => r.data),
      ]);
      setCategories(cats);
      setBrands(brs);
      setModels(mds);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => {
    setForm({ name: '', icon: 'Box', description: '', active: true, sortOrder: 0 });
    setFormCategory('');
    setFormBrand('');
    setImage(null);
    setImagePreview('');
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name) { setMsg('Name required'); return; }
    setSaving(true);
    setMsg('');

    try {
      if (tab === 'categories') {
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('icon', form.icon);
        fd.append('description', form.description);
        fd.append('active', String(form.active));
        fd.append('sortOrder', String(form.sortOrder));
        if (image) fd.append('image', image);
        if (editing) {
          await api.put(`/admin/sell/categories/${editing._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        } else {
          await api.post('/admin/sell/categories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      } else if (tab === 'brands') {
        if (!formCategory) { setMsg('Select a category'); setSaving(false); return; }
        if (editing) {
          await api.put(`/admin/sell/brands/${editing._id}`, { name: form.name, category: formCategory, active: form.active, sortOrder: form.sortOrder });
        } else {
          await api.post('/admin/sell/brands', { name: form.name, category: formCategory, active: form.active, sortOrder: form.sortOrder });
        }
      } else if (tab === 'models') {
        if (!formBrand) { setMsg('Select a brand'); setSaving(false); return; }
        if (editing) {
          await api.put(`/admin/sell/models/${editing._id}`, { name: form.name, brand: formBrand, active: form.active, sortOrder: form.sortOrder });
        } else {
          await api.post('/admin/sell/models', { name: form.name, brand: formBrand, active: form.active, sortOrder: form.sortOrder });
        }
      }
      setMsg(editing ? 'Updated' : 'Created');
      resetForm();
      fetchAll();
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete? This will also delete related sub-items.')) return;
    try {
      if (tab === 'categories') { await api.delete(`/admin/sell/categories/${id}`); }
      else if (tab === 'brands') { await api.delete(`/admin/sell/brands/${id}`); }
      else if (tab === 'models') { await api.delete(`/admin/sell/models/${id}`); }
      setMsg('Deleted');
      resetForm();
      fetchAll();
    } catch { }
  };

  const startEdit = (item: any) => {
    setEditing(item);
    setForm({ name: item.name, icon: item.icon || 'Box', description: item.description || '', active: item.active, sortOrder: item.sortOrder || 0 });
    if (tab === 'categories') {
      setFormCategory('');
      setImage(null);
      setImagePreview('');
    } else if (tab === 'brands') {
      setFormCategory(item.category?._id || item.category || '');
    } else if (tab === 'models') {
      setFormBrand(item.brand?._id || item.brand || '');
    }
    setShowForm(true);
  };

  const switchTab = (key: string) => {
    setTab(key);
    resetForm();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/sell" className="text-muted-foreground hover:text-primary"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="font-display text-2xl font-black">Sell Products</h1>
          <p className="text-sm text-muted-foreground">Manage Categories, Brands & Models for the sell form</p>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl border p-3 mb-4 text-sm font-bold ${msg.includes('Failed') || msg.includes('required') ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'}`}>{msg}</div>
      )}

       <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Layers className="inline h-3.5 w-3.5 mr-1" />{t.label}
            </button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add {tab === 'categories' ? 'Category' : tab === 'brands' ? 'Brand' : 'Model'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/50 bg-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{editing ? 'Edit' : 'New'} {tab === 'categories' ? 'Category' : tab === 'brands' ? 'Brand' : 'Model'}</h3>
            <button onClick={resetForm}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
          </div>

          {tab === 'brands' && (
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Category *</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
                <option value="">Select category</option>
                {categories.filter((c) => c.active).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {tab === 'models' && (
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Brand *</label>
              <select value={formBrand} onChange={(e) => setFormBrand(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
                <option value="">Select brand</option>
                {brands.filter((b) => b.active).map((b) => (
                  <option key={b._id} value={b._id}>{b.name} ({b.category?.name})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={tab === 'categories' ? 'e.g. Graphics Card' : tab === 'brands' ? 'e.g. ASUS' : 'e.g. RTX 3080'} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" />
            </div>

            {tab === 'categories' && (
              <div>
                <label className="block text-sm font-bold mb-1">Icon</label>
                <select value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
                  {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            )}
          </div>

          {tab === 'categories' && (
            <>
              <div className="mt-4"><label className="block text-sm font-bold mb-1">Description</label><input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
              <div className="mt-4"><label className="block text-sm font-bold mb-1">Image (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm cursor-pointer hover:border-primary"><Upload className="h-4 w-4" /> Choose Image
                    <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImage(f); setImagePreview(URL.createObjectURL(f)); } }} className="hidden" />
                  </label>
                  {imagePreview && <img src={imagePreview} alt="" className="h-10 w-10 rounded-lg object-cover border" />}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-6 mt-4">
            <div><label className="block text-sm font-bold mb-1">Sort Order</label><input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-sm" /></div>
            <div className="pt-6"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active</label></div>
          </div>

          <button onClick={handleSave} disabled={saving} className="mt-4 flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : `Save ${tab === 'categories' ? 'Category' : tab === 'brands' ? 'Brand' : 'Model'}`}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="text-left px-4 py-3 font-bold text-xs uppercase">Name</th>
                {tab !== 'categories' && <th className="text-left px-4 py-3 font-bold text-xs uppercase">{tab === 'brands' ? 'Category' : 'Brand'}</th>}
                {tab === 'models' && <th className="text-left px-4 py-3 font-bold text-xs uppercase">Category</th>}
                <th className="text-left px-4 py-3 font-bold text-xs uppercase">Active</th>
                <th className="text-left px-4 py-3 font-bold text-xs uppercase">Sort</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tab === 'categories' && categories.map((c) => (
                <tr key={c._id} className="border-b border-border hover:bg-surface/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.image ? <img src={getImageUrl(c.image)} alt="" className="h-6 w-6 rounded object-cover" /> : <div className="h-6 w-6 rounded bg-surface flex items-center justify-center"><Image className="h-3 w-3 text-muted-foreground" /></div>}
                      <span className="font-bold">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`inline-block w-2 h-2 rounded-full ${c.active ? 'bg-green-500' : 'bg-red-500'}`} /></td>
                  <td className="px-4 py-3 text-xs">{c.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { startEdit(c); }} className="rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10">Edit</button>
                      <button onClick={() => handleDelete(c._id)} className="rounded-lg px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tab === 'brands' && brands.map((b) => (
                <tr key={b._id} className="border-b border-border hover:bg-surface/30">
                  <td className="px-4 py-3 font-bold">{b.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.category?.name}</td>
                  <td className="px-4 py-3"><span className={`inline-block w-2 h-2 rounded-full ${b.active ? 'bg-green-500' : 'bg-red-500'}`} /></td>
                  <td className="px-4 py-3 text-xs">{b.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { startEdit(b); }} className="rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10">Edit</button>
                      <button onClick={() => handleDelete(b._id)} className="rounded-lg px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tab === 'models' && models.map((m) => (
                <tr key={m._id} className="border-b border-border hover:bg-surface/30">
                  <td className="px-4 py-3 font-bold">{m.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.brand?.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.brand?.category?.name}</td>
                  <td className="px-4 py-3"><span className={`inline-block w-2 h-2 rounded-full ${m.active ? 'bg-green-500' : 'bg-red-500'}`} /></td>
                  <td className="px-4 py-3 text-xs">{m.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { startEdit(m); }} className="rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10">Edit</button>
                      <button onClick={() => handleDelete(m._id)} className="rounded-lg px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {((tab === 'categories' && categories.length === 0) || (tab === 'brands' && brands.length === 0) || (tab === 'models' && models.length === 0)) && (
            <div className="p-12 text-center text-muted-foreground">No {tab} yet. Click "Add" to create one.</div>
          )}
        </div>
      )}
    </div>
  );
}
