import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { userApi } from '@/lib/api';
import { User, MapPin, Plus, Trash2, Pencil, X, Check, Shield, Coins } from 'lucide-react';

type Address = {
  _id: string;
  label: string;
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber?: string;
  isDefault: boolean;
};

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState({ label: '', fullName: '', streetAddress: '', city: '', state: '', zipCode: '', phoneNumber: '', isDefault: false });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadAddresses();
  }, [user]);

  const loadAddresses = async () => {
    try {
      const data = await userApi.getAddresses();
      setAddresses(data.addresses || []);
    } catch { setAddresses([]); }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ label: '', fullName: '', streetAddress: '', city: '', state: '', zipCode: '', phoneNumber: '', isDefault: false });
    setShowForm(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({ label: a.label || '', fullName: a.fullName, streetAddress: a.streetAddress, city: a.city, state: a.state, zipCode: a.zipCode, phoneNumber: a.phoneNumber || '', isDefault: a.isDefault });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); setMsg(null); };

  const remove = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    try { await userApi.deleteAddress(id); await loadAddresses(); } catch { setMsg('Delete failed'); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await userApi.updateAddress(editing._id, form);
      } else {
        await userApi.addAddress(form);
      }
      closeForm();
      await loadAddresses();
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed');
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-black">My Profile</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="rounded-xl border border-border bg-card p-6 h-fit">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl font-black text-primary">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">{user?.name}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="mt-1 inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/15 text-primary">{user?.role}</span>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <Link to="/orders" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition">
                <Shield className="h-4 w-4" /> My Orders
              </Link>
              <Link to="/sell/status" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition">
                <Coins className="h-4 w-4" /> Sell Requests
              </Link>
              <button onClick={() => { logout(); navigate('/'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                <X className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-black">Saved Addresses</h2>
              <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"><Plus className="h-3.5 w-3.5" /> Add</button>
            </div>

            {msg && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive mb-4">{msg}</div>}
            {addresses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No saved addresses. Add one for faster checkout.</div>
            ) : (
              <div className="grid gap-3">
                {addresses.map((a) => (
                  <div key={a._id} className={`rounded-xl border p-4 transition ${a.isDefault ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {a.label && <span className="text-xs font-bold uppercase tracking-wider text-primary">{a.label}</span>}
                          {a.isDefault && <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary"><Check className="h-3 w-3" /> Default</span>}
                        </div>
                        <p className="mt-1 font-bold">{a.fullName}</p>
                        <p className="text-sm text-muted-foreground">{a.streetAddress}, {a.city}, {a.state} - {a.zipCode}</p>
                        {a.phoneNumber && <p className="text-sm text-muted-foreground">{a.phoneNumber}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(a._id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeForm}>
            <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-black">{editing ? 'Edit Address' : 'New Address'}</h2>
                <button type="button" onClick={closeForm} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <AddressField label="Label (Home/Office)" value={form.label} onChange={(v: string) => setForm({ ...form, label: v })} />
                <AddressField label="Full Name" value={form.fullName} onChange={(v: string) => setForm({ ...form, fullName: v })} required />
                <AddressField label="Street Address" value={form.streetAddress} onChange={(v: string) => setForm({ ...form, streetAddress: v })} required />
                <div className="grid grid-cols-2 gap-3">
                  <AddressField label="City" value={form.city} onChange={(v: string) => setForm({ ...form, city: v })} required />
                  <AddressField label="State" value={form.state} onChange={(v: string) => setForm({ ...form, state: v })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <AddressField label="Zip Code" value={form.zipCode} onChange={(v: string) => setForm({ ...form, zipCode: v })} required />
                  <AddressField label="Phone" value={form.phoneNumber} onChange={(v: string) => setForm({ ...form, phoneNumber: v })} />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded border-border" />
                  Set as default address
                </label>
                {msg && <div className="rounded-md border border-border bg-surface/60 px-3 py-2 text-xs">{msg}</div>}
              </div>
              <div className="mt-5 flex gap-2">
                <button type="submit" className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">{editing ? 'Update' : 'Add Address'}</button>
                <button type="button" onClick={closeForm} className="rounded-full border border-border px-4 py-2.5 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function AddressField({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
    </div>
  );
}
