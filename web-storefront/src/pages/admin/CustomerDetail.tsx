import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/cart';
import { ArrowLeft, Mail, MapPin, Package, Pencil, Trash2, Plus, Check, X, Save, Eye, EyeOff } from 'lucide-react';

type Address = { _id?: string; label: string; fullName: string; streetAddress: string; city: string; state: string; zipCode: string; phoneNumber: string; isDefault: boolean };

export default function AdminCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const { isAdmin } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const load = () => {
    if (!customerId) return;
    adminApi.getCustomerDetail(customerId).then((r) => {
      setData(r);
      const c = r.customer as Record<string, unknown>;
      setForm({ name: String(c.name || ''), email: String(c.email || ''), password: '', role: String(c.role || 'user') });
      setAddresses(((c.addresses as Address[]) || []).map((a: Address) => ({ ...a })));
    }).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [customerId]);

  const addAddress = () => {
    setAddresses([...addresses, { label: 'Address', fullName: form.name, streetAddress: '', city: '', state: '', zipCode: '', phoneNumber: '', isDefault: addresses.length === 0 }]);
  };

  const updateAddr = (idx: number, field: keyof Address, val: string | boolean) => {
    setAddresses((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const removeAddr = (idx: number) => {
    setAddresses((prev) => prev.filter((_, i) => i !== idx));
  };

  const setDefault = (idx: number) => {
    setAddresses((prev) => prev.map((a, i) => ({ ...a, isDefault: i === idx })));
  };

  const handleSave = async () => {
    if (!customerId) return;
    setSaving(true);
    setEditMsg(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        addresses: addresses.map((a) => ({
          label: a.label,
          fullName: a.fullName,
          streetAddress: a.streetAddress,
          city: a.city,
          state: a.state,
          zipCode: a.zipCode,
          phoneNumber: a.phoneNumber,
          isDefault: a.isDefault,
        })),
      };
      if (form.password.trim()) payload.password = form.password.trim();
      await adminApi.updateCustomer(customerId, payload);
      setEditMsg({ type: 'success', text: 'Customer updated' });
      setEditing(false);
      load();
    } catch (err: unknown) {
      setEditMsg({ type: 'error', text: (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    const c = data?.customer as Record<string, unknown>;
    if (c) {
      setForm({ name: String(c.name || ''), email: String(c.email || ''), password: '', role: String(c.role || 'user') });
      setAddresses(((c.addresses as Address[]) || []).map((a: Address) => ({ ...a })));
    }
    setEditing(false);
    setEditMsg(null);
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!data) return (
    <div className="py-12 text-center">
      <h2 className="font-display text-xl font-black">Customer not found</h2>
      <Link to="/admin/customers" className="text-primary underline mt-2 inline-block">Back to Customers</Link>
    </div>
  );

  const customer = data.customer as Record<string, unknown>;
  const orders = (data.orders as Record<string, unknown>[]) || [];
  const displayAddr = editing ? addresses : ((customer.addresses as Address[]) || []);

  const statusClass = (s: string) => {
    switch (s) { case 'delivered': return 'bg-primary/15 text-primary'; case 'shipped': return 'bg-blue-500/15 text-blue-400'; default: return 'bg-yellow-500/15 text-yellow-400'; }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/admin/customers" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customers
        </Link>
        {isAdmin && !editing && (
          <button onClick={() => { setEditing(true); setEditMsg(null); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-bold hover:bg-surface transition">
            <Pencil className="h-3.5 w-3.5" /> Edit Customer
          </button>
        )}
      </div>

      {editMsg && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${editMsg.type === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
          {editMsg.text}
        </div>
      )}

      <div className={`rounded-xl border bg-card p-5 ${editing ? 'ring-2 ring-primary/30' : ''}`}>
        {editing ? (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Edit Customer Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Password (leave blank to keep)</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars" className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 pr-10 text-sm outline-none focus:border-primary" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="ca">CA</option>
                  <option value="shipping">Shipping</option>
                </select>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Addresses</h3>
                <button onClick={addAddress} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus className="h-3 w-3" /> Add</button>
              </div>
              {addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No addresses</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((a, i) => (
                    <div key={i} className={`rounded-lg border p-3 ${a.isDefault ? 'border-primary bg-primary/5' : 'border-border bg-surface/40'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={a.label} onChange={(e) => updateAddr(i, 'label', e.target.value)} className="h-7 w-24 rounded border border-border bg-input px-2 text-[10px] font-bold outline-none focus:border-primary" placeholder="Label" />
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <input type="checkbox" checked={a.isDefault} onChange={() => setDefault(i)} className="accent-primary" /> Default
                          </label>
                        </div>
                        <button onClick={() => removeAddr(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <AddrField placeholder="Full Name" value={a.fullName} onChange={(v) => updateAddr(i, 'fullName', v)} />
                        <AddrField placeholder="Phone" value={a.phoneNumber} onChange={(v) => updateAddr(i, 'phoneNumber', v)} />
                        <AddrField placeholder="Pincode" value={a.zipCode} onChange={(v) => updateAddr(i, 'zipCode', v)} />
                        <AddrField placeholder="Street" className="col-span-2" value={a.streetAddress} onChange={(v) => updateAddr(i, 'streetAddress', v)} />
                        <div className="flex gap-2 col-span-2 sm:col-span-3">
                          <AddrField placeholder="City" value={a.city} onChange={(v) => updateAddr(i, 'city', v)} />
                          <AddrField placeholder="State" value={a.state} onChange={(v) => updateAddr(i, 'state', v)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-bold hover:bg-surface"><X className="h-4 w-4" /> Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-xl font-black text-primary">
                {String(customer.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">{String(customer.name)}</h2>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{String(customer.email)}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Role" value={<span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${customer.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-surface text-muted-foreground'}`}>{String(customer.role)}</span>} />
              <Row label="Joined" value={customer.createdAt ? new Date(String(customer.createdAt)).toLocaleDateString('en-IN') : 'N/A'} />
              <Row label="Orders" value={<span className="font-bold">{orders.length}</span>} />
              <Row label="Addresses" value={<span className="font-bold">{displayAddr.length}</span>} />
              <Row label="User ID" value={<span className="font-mono text-xs break-all">{String(customer._id)}</span>} />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayAddr.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-2 mb-3 flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Addresses ({displayAddr.length})</h3>
            <div className="space-y-3">
              {displayAddr.map((a) => {
                const addr = a;
                const isDef = Boolean(addr.isDefault);
                return (
                  <div key={String(addr._id || Math.random())} className={`rounded-lg bg-surface/40 p-3 ${isDef ? 'ring-2 ring-primary' : ''}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {addr.label ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{String(addr.label)}</span> : null}
                      {isDef ? <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">Default</span> : null}
                    </div>
                    <p className="font-semibold text-xs">{String(addr.fullName || '')}</p>
                    <p className="text-[10px] text-muted-foreground">{String(addr.streetAddress || '')}</p>
                    <p className="text-[10px] text-muted-foreground">{String(addr.city || '')}, {String(addr.state || '')} - {String(addr.zipCode || '')}</p>
                    {addr.phoneNumber ? <p className="text-[10px] text-muted-foreground mt-1">{String(addr.phoneNumber)}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-2 mb-3 flex items-center gap-2"><Package className="h-3.5 w-3.5" /> Orders ({orders.length})</h3>
          {orders.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No orders yet</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {orders.map((o) => {
                const ord = o as Record<string, unknown>;
                const items = (ord.orderItems as unknown[]) || [];
                return (
                  <Link key={String(ord._id)} to={`/admin/orders/${String(ord._id)}`} className="flex items-center justify-between rounded-lg bg-surface/40 p-3 hover:bg-surface transition">
                    <div>
                      <span className="font-mono text-sm font-bold text-primary">#{String(ord._id).slice(-8).toUpperCase()}</span>
                      <p className="text-xs text-muted-foreground">{items.length} item(s) · {ord.createdAt ? new Date(String(ord.createdAt)).toLocaleDateString('en-IN') : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${statusClass(String(ord.status))}`}>{String(ord.status)}</span>
                      <span className="font-display font-bold text-primary">{formatINR(Number(ord.totalPrice) || 0)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span>{value}</div>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
    </div>
  );
}

function AddrField({ placeholder, value, onChange, className }: { placeholder: string; value: string; onChange: (v: string) => void; className?: string }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`h-8 rounded border border-border bg-input px-2 text-[10px] outline-none focus:border-primary ${className || ''}`} />;
}
