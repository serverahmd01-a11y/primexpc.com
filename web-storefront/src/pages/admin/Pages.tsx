import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, X, Eye, EyeOff } from 'lucide-react';

type Page = {
  _id: string;
  title: string;
  slug: string;
  content: string;
  active: boolean;
  sortOrder: number;
};

export default function AdminPages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/admin/pages').then((r) => setPages(r.data || [])).catch(() => setPages([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null); setTitle(''); setSlug(''); setContent(''); setSortOrder('0'); setActive(true); setMsg(null); setShowModal(true);
  };

  const openEdit = (p: Page) => {
    setEditing(p); setTitle(p.title); setSlug(p.slug); setContent(p.content); setSortOrder(String(p.sortOrder || 0)); setActive(p.active); setMsg(null); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const remove = async (p: Page) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try { await api.delete(`/admin/pages/${p._id}`); await load(); } catch { setMsg('Delete failed'); }
  };

  const toggleActive = async (p: Page) => {
    try {
      const res = await api.patch(`/admin/pages/${p._id}/toggle`);
      setPages((prev) => prev.map((pg) => pg._id === p._id ? res.data : pg));
    } catch { setMsg('Toggle failed'); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) { setMsg('Title and slug are required'); return; }
    setSaving(true);
    try {
      const data = { title: title.trim(), slug: slug.trim().toLowerCase().replace(/\s+/g, '-'), content, active, sortOrder: parseInt(sortOrder) || 0 };
      if (editing) {
        await api.put(`/admin/pages/${editing._id}`, data);
      } else {
        await api.post('/admin/pages', data);
      }
      setShowModal(false); setEditing(null); await load();
    } catch (err: unknown) { setMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-black">Pages</h2>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">
          <Plus className="h-4 w-4" /> Add Page
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No pages yet. Create one to show in footer.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Active</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-16">Order</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p._id} className="border-b border-border/50 hover:bg-surface/30 transition">
                  <td className="px-4 py-3 text-sm font-bold">{p.title}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">/{p.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(p)} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${p.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {p.active ? <><Eye className="h-3 w-3" /> On</> : <><EyeOff className="h-3 w-3" /> Off</>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">{p.sortOrder || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-md border border-border p-1.5 hover:border-primary hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(p)} className="rounded-md border border-border p-1.5 hover:border-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-black">{editing ? 'Edit Page' : 'New Page'}</h2>
              <button type="button" onClick={closeModal} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="About Us" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Slug</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono" placeholder="about-us" required />
                <p className="mt-1 text-[10px] text-muted-foreground">URL: /page/<b>{slug || 'about-us'}</b></p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content</label>
                <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" placeholder="Write page content here..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sort Order</label>
                  <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-border" />
                    Active (visible on site)
                  </label>
                </div>
              </div>
              {msg && <div className="rounded-md border border-border bg-surface/60 px-3 py-2 text-xs">{msg}</div>}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Create Page'}</button>
              <button type="button" onClick={closeModal} className="rounded-full border border-border px-4 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
