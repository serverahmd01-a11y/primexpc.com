import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo } from '@/lib/utils';
import { Plus, Trash2, Save, PackagePlus, Loader2, Banknote, CreditCard, Search, PackageX, Check } from 'lucide-react';
import Pagination, { paginate, sortNewestFirst } from './Pagination';

type SelectedItem = { productId: string; quantity: number };
type Address = { fullName: string; streetAddress: string; city: string; state: string; zipCode: string; phoneNumber: string };
type SearchableOption = { value: string; label: string };

const emptyAddress: Address = { fullName: '', streetAddress: '', city: '', state: '', zipCode: '', phoneNumber: '' };

function SearchableSelect({ options, value, onChange, placeholder }: {
  options: SearchableOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((opt) => opt.value === value);
  const filtered = query.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)} className="flex h-11 w-full items-center justify-between rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30">
        <span className={selected ? 'font-medium' : 'text-muted-foreground'}>{selected ? selected.label : placeholder}</span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border bg-input px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results found</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                  className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-primary/5 ${opt.value === value ? 'font-bold text-primary' : 'text-foreground'}`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMissedOrders() {
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [missedOrders, setMissedOrders] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [userId, setUserId] = useState('');
  const [paymentType, setPaymentType] = useState<'cod' | 'prepaid'>('cod');
  const [items, setItems] = useState<SelectedItem[]>([{ productId: '', quantity: 1 }]);
  const [razorpayPaymentId, setRazorpayPaymentId] = useState('');
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [address, setAddress] = useState<Address>({ ...emptyAddress });
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [savingStock, setSavingStock] = useState<string | null>(null);
  const [stockMsg, setStockMsg] = useState<string | null>(null);

  const userOptions = useMemo<SearchableOption[]>(
    () => customers.map((c) => ({ value: String(c._id), label: `${String(c.name)} — ${String(c.email)}` })),
    [customers]
  );
  const productOptions = useMemo<SearchableOption[]>(
    () => products.map((p) => ({ value: String(p._id), label: `${String(p.name)} — ${formatINR(Number(p.salePrice) || Number(p.price) || 0)} (Stock: ${Number(p.stock) || 0})` })),
    [products]
  );

  const load = () => {
    Promise.all([adminApi.getCustomers(), adminApi.getProducts(), adminApi.getMissedOrders()])
      .then(([c, p, m]) => {
        setCustomers(c.customers || []);
        setProducts(p || []);
        setMissedOrders(m.orders || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const productMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    products.forEach((p) => map.set(String(p._id), p));
    return map;
  }, [products]);

  const total = items.reduce((sum, it) => {
    const p = productMap.get(it.productId);
    const price = Number(p?.salePrice) || Number(p?.price) || 0;
    return sum + price * (it.quantity || 1);
  }, 0);

  const advance = Math.round(total * 0.25);
  const balance = Math.max(0, total - advance);

  const addProductRow = () => setItems((prev) => [...prev, { productId: '', quantity: 1 }]);
  const updateItem = (idx: number, patch: Partial<SelectedItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateStock = async (productId: string) => {
    const value = stockEdits[productId];
    if (value === undefined || value.trim() === '') return;
    const num = Number(value.trim());
    if (!Number.isFinite(num) || num < 0) { setStockMsg('Invalid stock value'); return; }
    setSavingStock(productId);
    setStockMsg(null);
    try {
      await adminApi.updateProductStock(productId, num);
      await load();
      setStockEdits((prev) => { const n = { ...prev }; delete n[productId]; return n; });
      setStockMsg('Stock updated');
    } catch {
      setStockMsg('Stock update failed');
    } finally {
      setSavingStock(null);
    }
  };

  const handleSave = async () => {
    setError(''); setSuccess('');
    if (!userId) { setError('Please select a user'); return; }
    if (!items.some((it) => it.productId && it.quantity > 0)) { setError('Please add at least one product'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        userId,
        paymentType,
        items: items.filter((it) => it.productId).map((it) => ({ productId: it.productId, quantity: it.quantity })),
        totalPrice: total,
        codAdvanceAmount: paymentType === 'cod' ? advance : 0,
      };
      if (razorpayPaymentId.trim()) payload.razorpayPaymentId = razorpayPaymentId.trim();
      if (!useSavedAddress) payload.shippingAddress = address;
      await adminApi.createMissedOrder(payload);
      setSuccess('Missed order created. It is now visible to the user and in admin orders.');
      setItems([{ productId: '', quantity: 1 }]);
      setRazorpayPaymentId('');
      setUserId('');
      setUseSavedAddress(true);
      setAddress({ ...emptyAddress });
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create missed order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-black uppercase tracking-wider">Create Missed Order</h2>
        </div>
        <p className="mb-5 text-xs text-muted-foreground">
          Use this when payment reached the Razorpay account but the order was not placed. Select the user, add products and payment type, then save.
        </p>

        <div className="grid gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">User</label>
            <SearchableSelect options={userOptions} value={userId} onChange={setUserId} placeholder="Search & select user..." />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Products</label>
            <div className="space-y-2">
              {items.map((it, idx) => {
                const p = productMap.get(it.productId);
                const price = Number(p?.salePrice) || Number(p?.price) || 0;
                const stock = Number(p?.stock) ?? 0;
                const isOut = stock <= 0;
                return (
                  <div key={idx}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <SearchableSelect options={productOptions} value={it.productId}
                          onChange={(v) => updateItem(idx, { productId: v })}
                          placeholder="Search & select product..." />
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateItem(idx, { quantity: e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value) || 1) })}
                        className="h-10 w-20 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="w-24 text-right text-sm font-bold text-primary">{p ? formatINR(price * it.quantity) : ''}</span>
                      <button onClick={() => removeItem(idx)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {p && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-1">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${isOut ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          {isOut ? <PackageX className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          {isOut ? 'Out of Stock' : `Stock: ${stock}`}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={stockEdits[it.productId] ?? ''}
                            onChange={(e) => setStockEdits((prev) => ({ ...prev, [it.productId]: e.target.value }))}
                            placeholder={String(stock)}
                            className="h-8 w-20 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => updateStock(it.productId)}
                            disabled={savingStock === it.productId || !(stockEdits[it.productId] ?? '').trim()}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                          >
                            {savingStock === it.productId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Update Stock
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addProductRow} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Type</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPaymentType('cod')}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition ${paymentType === 'cod' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50'}`}>
                <Banknote className="h-4 w-4" /> COD (Advance)
              </button>
              <button type="button" onClick={() => setPaymentType('prepaid')}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition ${paymentType === 'prepaid' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50'}`}>
                <CreditCard className="h-4 w-4" /> Prepaid
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Razorpay Payment ID (optional)</label>
            <input
              type="text"
              value={razorpayPaymentId}
              onChange={(e) => setRazorpayPaymentId(e.target.value)}
              placeholder="e.g. pay_P7xK2mNvQw3AbC"
              className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Shipping Address</label>
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={useSavedAddress} onChange={(e) => setUseSavedAddress(e.target.checked)} className="h-4 w-4 accent-primary" />
              Use customer&apos;s saved default address
            </label>
            {!useSavedAddress && (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="text" value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} placeholder="Full Name" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
                  <input type="text" value={address.phoneNumber} onChange={(e) => setAddress({ ...address, phoneNumber: e.target.value })} placeholder="Phone Number" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
                <input type="text" value={address.streetAddress} onChange={(e) => setAddress({ ...address, streetAddress: e.target.value })} placeholder="Street Address" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
                  <input type="text" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="State" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
                <input type="text" value={address.zipCode} onChange={(e) => setAddress({ ...address, zipCode: e.target.value })} placeholder="Zip / PIN Code" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface/40 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatINR(total)}</span></div>
            {paymentType === 'cod' ? (
              <>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">Advance Received (25%)</span><span className="font-bold text-primary">{formatINR(advance)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">Balance Pending (75%)</span><span className="font-bold text-amber-600">{formatINR(balance)}</span></div>
              </>
            ) : (
              <div className="flex justify-between mt-1"><span className="text-muted-foreground">Payment Received (100%)</span><span className="font-bold text-primary">{formatINR(total)}</span></div>
            )}
          </div>

          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</div>}
          {success && <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">{success}</div>}
          {stockMsg && <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${stockMsg.includes('Failed') ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/40 bg-primary/10 text-primary'}`}>{stockMsg}</div>}

          <div>
            <button onClick={handleSave} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Missed Order</>}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-black">Missed Orders ({missedOrders.length})</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>
        ) : missedOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No missed orders added yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Order No.</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortNewestFirst(missedOrders), page, perPage).map((o) => (
                  <tr key={String(o._id)} className="border-b border-border">
                    <td className="px-5 py-3">
                      <Link to={`/admin/orders/${String(o._id)}`} className="font-mono text-xs text-primary hover:underline">
                        #{formatOrderNo(o.orderNumber) || String(o._id).slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{String((o.user as Record<string, string>)?.name || 'N/A')}</div>
                      <div className="text-xs text-muted-foreground">{String((o.user as Record<string, string>)?.email || '')}</div>
                    </td>
                    <td className="px-5 py-3">{String((o.orderItems as unknown[])?.length || 0)} item(s)</td>
                    <td className="px-5 py-3 font-bold text-primary">{formatINR(Number(o.totalPrice) || 0)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${(o.paymentResult as Record<string, string>)?.status === 'cod_advance' ? 'bg-amber-500/15 text-amber-600' : 'bg-blue-500/15 text-blue-400'}`}>
                        {(o.paymentResult as Record<string, string>)?.status === 'cod_advance' ? 'COD' : 'Prepaid'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {(o.paymentResult as Record<string, string>)?.status === 'cod_advance' ? (
                        <div className="space-y-1 text-[11px] font-bold">
                          <div className={o.advancePaid ? 'text-primary' : 'text-amber-600'}>
                            Advance{(o.advancePaid ? '' : ' Pending')} · {formatINR(Number(o.codAdvanceAmount) || 0)}
                          </div>
                          <div className={o.balancePaid ? 'text-primary' : 'text-amber-600'}>
                            Balance{Number(o.balancePaid) ? '' : ' Pending'} · {formatINR(Math.max(0, (Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0)))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-primary">Paid {formatINR(Number(o.totalPrice) || 0)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 capitalize">{String(o.status)}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          total={missedOrders.length}
          page={page}
          perPage={perPage}
          onPage={setPage}
          onPerPage={(n) => { setPerPage(n); setPage(1); }}
        />
      </div>
    </div>
  );
}
