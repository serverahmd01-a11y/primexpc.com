import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, CreditCard, Landmark, Wallet, Zap, ShieldCheck, Banknote, MemoryStick, Loader2, Download } from 'lucide-react';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl, downloadInvoice as genInvoice, formatOrderNo } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { userApi, paymentApi, orderApi } from '@/lib/api';
import api from '@/lib/api';
import { beginCheckout, purchase as gaPurchase } from '@/lib/analytics';

type Payment = { id: string; label: string; desc: string; icon: typeof CreditCard };
type SavedAddress = { _id: string; label: string; fullName: string; streetAddress: string; city: string; state: string; zipCode: string; phoneNumber?: string; isDefault: boolean };

const PAYMENT_OPTIONS: Payment[] = [
  { id: 'online', label: 'Online Payment', desc: 'Pay via UPI, Card, Net Banking — Razorpay', icon: CreditCard },
  { id: 'cod', label: 'Cash on Delivery', desc: 'Pay 25% advance, rest at delivery', icon: Banknote },
];

declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, fn: () => void) => void }; } }

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => { razorpayScriptPromise = null; resolve(false); };
    document.body.appendChild(s);
  });
  return razorpayScriptPromise;
}

export default function Checkout() {
  const { items, subtotal, clear, refreshPrices } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [payment, setPayment] = useState('online');
  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [paidTotal, setPaidTotal] = useState(0);
  const [wasCod, setWasCod] = useState(false);
  const invoiceItemsRef = useRef(items);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', pincode: '', street: '', landmark: '', city: '', state: '', country: 'India' });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/checkout', { replace: true });
      return;
    }
    api.get('/settings/public-key').then((r) => setRazorpayKeyId(r.data.key_id || '')).catch(() => {});
    refreshPrices();
    if (user) {
      userApi.getAddresses().then((d) => setSavedAddresses(d.addresses || [])).catch(() => {});
      setForm((f) => ({ ...f, email: f.email || user.email || '', name: f.name || user.name || '' }));
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (items.length > 0) {
      beginCheckout(items.map((i) => ({ id: i.productId || i.slug, name: i.name, price: i.price, category: i.brand, quantity: i.qty })), subtotal);
    }
  }, []);

  const selectAddress = (a: SavedAddress) => {
    setSelectedAddressId(a._id);
    setForm({ ...form, name: a.fullName, phone: a.phoneNumber || '', pincode: a.zipCode, street: a.streetAddress, landmark: '', city: a.city, state: a.state, country: 'India' });
  };

  const total = subtotal;

  const finish = (id: string, num?: unknown, cod = false, advanceAmount = 0) => {
    invoiceItemsRef.current = items;
    setOrderId(id);
    setOrderNumber(num ? formatOrderNo(num) : '');
    setPaidTotal(cod ? advanceAmount : total);
    setWasCod(cod);
    setPlaced(true);
    gaPurchase(id, items.map((i) => ({ id: i.productId || i.slug, name: i.name, price: i.price, category: i.brand, quantity: i.qty })), total);
    clear();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadInvoice = () => {
    genInvoice({
      orderId: orderNumber || orderId,
      items: invoiceItemsRef.current.map((i) => ({ name: i.name, price: i.price, quantity: i.qty, gstRate: i.gstRate })),
      customerName: form.name,
      customerPhone: form.phone,
      customerAddress: [form.street, form.city, form.state, form.pincode].filter(Boolean).join(', '),
    });
  };

  const onPlace = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0 || processing) return;
    setError('');

    const isCod = payment === 'cod';

    setProcessing(true);
    try {
      const freshSubtotal = (await refreshPrices()) as number | undefined;
      const currentTotal = (typeof freshSubtotal === 'number' && freshSubtotal > 0) ? freshSubtotal : total;
      const payAmount = isCod ? Math.round(currentTotal * 0.25) : currentTotal;

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load payment gateway. Check your connection.');

      const order = await paymentApi.createOrder({ amount: payAmount * 100, receipt: 'rcpt_' + Date.now().toString(36) });

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: order.keyId || razorpayKeyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'PrimeX PC',
          description: isCod ? `Convenience fee — COD order` : `Order — ${items.length} item(s)`,
          prefill: { name: form.name, email: form.email, contact: form.phone },
          theme: { color: '#10b981' },
          handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const v = await paymentApi.verify(resp);
              if (!v.verified) { reject(new Error('Payment verification failed')); return; }

              if (isCod) {
                const res = await orderApi.create({
                  orderItems: items.map((i) => ({ product: i.productId || i.slug, name: i.name, price: i.price, quantity: i.qty, gstRate: i.gstRate || 18, image: i.image || '' })),
                  shippingAddress: { fullName: form.name, streetAddress: form.street, city: form.city, state: form.state, zipCode: form.pincode, phoneNumber: form.phone },
                  paymentResult: { id: resp.razorpay_payment_id, status: 'cod_advance' },
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_signature: resp.razorpay_signature,
                  totalPrice: currentTotal,
                  codAdvanceAmount: payAmount,
                });
                finish(res.order?._id || resp.razorpay_order_id, res.order?.orderNumber, true, payAmount);
              } else {
                await paymentApi.placeOrder({
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_signature: resp.razorpay_signature,
                  cartItems: items.map((i) => ({ productId: i.productId || i.slug, quantity: i.qty })),
                  shippingAddress: { fullName: form.name, streetAddress: form.street, city: form.city, state: form.state, zipCode: form.pincode, phoneNumber: form.phone },
                  totalPrice: currentTotal,
                });
                finish(resp.razorpay_order_id);
              }
              resolve();
            } catch (err) { reject(err); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rzp.open();
      });
    } catch (err) {
      const msg = (err as any)?.response?.data?.error || (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Payment failed');
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  if (placed) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary shadow-[var(--shadow-glow)]"><Check className="h-10 w-10" /></div>
          <h1 className="mt-6 font-display text-4xl font-black">Payment Successful!</h1>
          <p className="mt-3 max-w-md text-muted-foreground">Thanks for choosing PrimeX. Your order <span className="font-bold text-primary">#{orderNumber || orderId}</span> is being prepared. {wasCod ? <>Advance payment of {formatINR(paidTotal)} received — remaining balance payable on delivery.</> : <>Payment of {formatINR(paidTotal)} received.</>}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={downloadInvoice} className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-7 py-3 text-sm font-bold uppercase tracking-wider text-primary hover:bg-primary/10">
              <Download className="h-4 w-4" /> Download Invoice
            </button>
            <Link to="/orders" className="rounded-full border border-primary/40 px-7 py-3 text-sm font-bold uppercase tracking-wider text-primary hover:bg-primary/10">View Orders</Link>
            <Link to="/" className="rounded-full bg-primary px-7 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">Back to Home</Link>
          </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Continue Shopping</Link>
        <h1 className="mt-3 font-display text-3xl font-black md:text-4xl">Checkout</h1>
      </div>

      {items.length === 0 ? (
        <div className="container mx-auto px-4 pb-20 text-center"><p className="text-muted-foreground">Your cart is empty.</p><Link to="/" className="mt-5 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground">Shop Now</Link></div>
      ) : (
        <form onSubmit={onPlace} className="container mx-auto grid gap-8 px-4 pb-20 lg:grid-cols-[1fr_400px]">
          <div className="space-y-8">
            <Section title="Contact" step={1}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
                <Field label="Mobile" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
              </div>
            </Section>

            <Section title="Shipping Address" step={2}>
              {savedAddresses.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saved Addresses</label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {savedAddresses.map((a) => (
                      <button key={a._id} type="button" onClick={() => selectAddress(a)} className={`text-left rounded-lg border p-3 text-xs transition ${selectedAddressId === a._id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                        <div className="flex items-center gap-1.5">{a.isDefault && <Check className="h-3 w-3 text-primary" />}<span className="font-bold">{a.label || 'Address'}</span></div>
                        <p className="mt-1 text-muted-foreground line-clamp-2">{a.fullName}, {a.streetAddress}, {a.city}, {a.state} {a.zipCode}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} required placeholder="560001" />
                <div className="sm:col-span-2"><Field label="Street Address" value={form.street} onChange={(v) => setForm({ ...form, street: v })} required placeholder="House no, building, street" /></div>
                <Field label="Landmark" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} placeholder="Optional" />
                <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
                <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} required />
                <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} required />
              </div>
            </Section>

            <Section title="Payment Method" step={3}>
              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((opt) => {
                  const selected = payment === opt.id;
                  return (
                    <label key={opt.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${selected ? 'border-primary bg-primary/5 shadow-[var(--shadow-glow)]' : 'border-border bg-card hover:border-primary/50'}`}>
                      <input type="radio" name="payment" value={opt.id} checked={selected} onChange={() => setPayment(opt.id)} className="sr-only" />
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}><opt.icon className="h-5 w-5" /></div>
                      <div className="flex-1"><div className="font-display text-sm font-bold uppercase tracking-wider">{opt.label}</div><div className="text-[11px] text-muted-foreground">{opt.desc}</div></div>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </label>
                  );
                })}
              </div>
              {payment !== 'cod' && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs text-muted-foreground">You'll complete payment securely via Razorpay. We never store your card or UPI details.</p></div>
              )}
            </Section>
          </div>

          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-black uppercase tracking-wider">Order Summary</h2>
              <ul className="mt-4 space-y-3 border-b border-border pb-4">
                {items.map((i) => (
                  <li key={i.slug} className="flex gap-3 text-sm">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-surface to-background overflow-hidden">
                      {i.image ? <img src={getImageUrl(i.image)} alt={i.name} className="h-full w-full object-cover" /> : <MemoryStick className="h-7 w-7 text-primary/70" strokeWidth={1.2} />}
                    </div>
                    <div className="flex-1"><div className="line-clamp-2 text-xs font-bold">{i.name}</div><div className="text-[11px] text-muted-foreground">Qty {i.qty}</div></div>
                    <div className="text-sm font-bold text-primary">{formatINR(i.price * i.qty)}</div>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Subtotal" value={formatINR(subtotal)} />
                <Row label="Shipping" value="FREE" />
                <Row label="GST" value={<span className="text-primary">Included</span>} />
              </dl>
              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4"><span className="font-display text-sm font-bold uppercase tracking-wider">Total</span><span className="font-display text-2xl font-black text-primary">{formatINR(total)}</span></div>

              {error && <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</div>}

              <label className="mt-4 flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                <span className="text-xs text-muted-foreground">
                  I agree to the <Link to="/page/terms-and-conditions" target="_blank" className="text-primary font-semibold hover:underline">Terms & Conditions</Link> and <Link to="/page/privacy-policy" target="_blank" className="text-primary font-semibold hover:underline">Privacy Policy</Link>
                </span>
              </label>

              <button type="submit" disabled={processing || !termsAccepted} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed">
                {processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : payment === 'cod' ? <><Banknote className="h-4 w-4" /> Pay 25% ({formatINR(Math.round(total * 0.25))}) — COD</> : <><ShieldCheck className="h-4 w-4" /> Pay {formatINR(total)}</>}
              </button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">{payment === 'cod' ? '25% advance now · Balance payable on delivery' : 'Secure payment by Razorpay · UPI, Cards, Net Banking'}</p>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-4 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">{step}</span><h2 className="font-display text-lg font-black uppercase tracking-wider">{title}</h2></div>{children}</section>;
}
function Field({ label, value, onChange, type = 'text', required, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" /></label>;
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-bold text-foreground">{value}</dd></div>;
}
