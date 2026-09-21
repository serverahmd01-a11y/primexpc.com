import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/cart';
import { formatOrderNo, getImageUrl, downloadInvoice, safeTrackingUrl } from '@/lib/utils';
import { ArrowLeft, Truck, Download, Link2, Save } from 'lucide-react';
import api from '@/lib/api';

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const [shipping, setShipping] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [trackInput, setTrackInput] = useState('');
  const [savingTrack, setSavingTrack] = useState(false);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/admin/orders/${orderId}`).then(({ data }) => {
      setOrder(data || null);
    }).catch(() => setOrder(null)).finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!order) return (
    <div className="py-12 text-center">
      <h2 className="font-display text-xl font-black">Order not found</h2>
      <Link to="/admin/orders" className="text-primary underline mt-2 inline-block">Back to Orders</Link>
    </div>
  );

  const o = order;
  const user = o.user as Record<string, string> || {};
  const addr = o.shippingAddress as Record<string, string> || {};
  const pay = o.paymentResult as Record<string, string> || {};
  const items = (o.orderItems as Record<string, unknown>[]) || [];
  const trackUrl = safeTrackingUrl(o.trackingUrl);

  const statusClass = (s: string) => {
    switch (s) {
      case 'delivered': return 'bg-primary/15 text-primary';
      case 'shipped': return 'bg-blue-500/15 text-blue-400';
      case 'cancelled': return 'bg-destructive/15 text-destructive';
      case 'returned': return 'bg-orange-500/15 text-orange-500';
      default: return 'bg-yellow-500/15 text-yellow-400';
    }
  };

  const handleShip = async () => {
    if (!confirm('Push this order to Shiprocket?')) return;
    setShipping(true); setShipMsg(null);
    try {
      await api.post(`/admin/shiprocket/ship/${orderId}`, {});
      setShipMsg('Order pushed to Shiprocket!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: unknown) {
      setShipMsg((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Shiprocket failed');
    } finally { setShipping(false); }
  };

const saveTracking = async () => {
    const link = trackInput.trim();
    if (!link) return;
    setSavingTrack(true); setTrackMsg(null);
    try {
      await api.patch(`/admin/orders/${orderId}/tracking`, { trackingUrl: link });
      setTrackInput('');
      const { data } = await api.get(`/admin/orders/${orderId}`);
      setOrder(data || null);
      setTrackMsg('Tracking link updated');
    } catch {
      setTrackMsg('Failed to update tracking link');
    } finally { setSavingTrack(false); }
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order No.</span>
          <p className="font-mono text-sm font-bold break-all mt-1">#{formatOrderNo(o.orderNumber) || String(o._id).slice(-8).toUpperCase()}</p>
          {!!o.isMissedOrder && <span className="mt-1 inline-flex rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-500">MISSED</span>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
          <p className="text-sm mt-1">{o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
          <span className={`inline-flex mt-1 rounded px-2 py-0.5 text-xs font-bold ${statusClass(String(o.status))}`}>{String(o.status)}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Type</span>
          <span className={`inline-flex mt-1 rounded px-2 py-0.5 text-xs font-bold ${pay.status === 'cod_advance' ? 'bg-amber-500/15 text-amber-600' : 'bg-blue-500/15 text-blue-400'}`}>
            {pay.status === 'cod_advance' ? 'COD' : 'Prepaid'}
          </span>
          {(o.codAdvanceAmount as number) > 0 && (
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Advance Paid</span><span className={o.advancePaid ? 'text-primary font-bold' : 'text-amber-600 font-bold'}>{o.advancePaid ? 'Yes' : 'Pending'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Advance Amount</span><span className="font-bold">{formatINR(Number(o.codAdvanceAmount) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Balance Amount</span><span className="font-bold">{formatINR(Math.max(0, (Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0)))}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Balance Received</span>
                <span className={`font-bold ${o.balancePaid ? 'text-primary' : 'text-amber-600'}`}>{o.balancePaid ? 'Yes' : 'No'}</span>
              </div>
              {o.balancePaidAt ? <div className="text-[10px] text-muted-foreground">Marked: {new Date(String(o.balancePaidAt)).toLocaleDateString('en-IN')}</div> : null}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shiprocket</span>
          <div className="mt-1">
            {o.shiprocket_awb ? (
              <>
                <p className="text-xs font-mono font-bold">{String(o.shiprocket_awb)}</p>
                <p className="text-[10px] text-muted-foreground">AWB | {String(o.shiprocket_courier_name || '')}</p>
              </>
            ) : o.status !== 'shipped' && o.status !== 'delivered' ? (
              <button onClick={handleShip} disabled={shipping} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                {shipping ? '...' : <><Truck className="h-3 w-3" /> Push to Shiprocket</>}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
            {shipMsg && <p className={`text-[10px] mt-1 ${shipMsg.includes('failed') ? 'text-destructive' : 'text-primary'}`}>{shipMsg}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tracking Link</span>
          <div className="mt-1 space-y-1.5">
            {(String(o.status) === 'shipped' || String(o.status) === 'delivered') && (
              <>
                {trackUrl ? (
                  <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-400 hover:bg-blue-500/25">
                    <Link2 className="h-3 w-3 shrink-0" /><span className="truncate">Track Order →</span>
                  </a>
                ) : null}
                <div className="flex items-center gap-1">
                  <input
                    value={trackInput}
                    onChange={(e) => setTrackInput(e.target.value)}
                    placeholder="Paste carrier tracking link (user will see it)"
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                  <button onClick={saveTracking} disabled={savingTrack || !trackInput.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                    {savingTrack ? '...' : <><Save className="h-3 w-3" /> Set</>}
                  </button>
                </div>
                {trackMsg && <p className="text-[10px] text-primary">{trackMsg}</p>}
              </>
            )}
            {!trackUrl && (String(o.status) !== 'shipped' && String(o.status) !== 'delivered') && (
              <span className="text-xs text-muted-foreground">Available after order is shipped</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
          <p className="font-display text-xl font-black text-primary mt-1">{formatINR(Number(o.totalPrice) || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-2 mb-3">Customer</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-semibold">{user.name || addr.fullName || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{String(user._id || 'N/A')}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-2 mb-3">Payment</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Razorpay Payment ID</span><span className="font-mono font-bold">{pay.id || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize font-semibold">{pay.status || 'N/A'}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-2 mb-3">Shipping Address</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><span className="text-[10px] text-muted-foreground">Name</span><p className="font-semibold">{addr.fullName || 'N/A'}</p></div>
          <div className="col-span-2"><span className="text-[10px] text-muted-foreground">Street</span><p>{addr.streetAddress || 'N/A'}</p></div>
          <div><span className="text-[10px] text-muted-foreground">City</span><p>{addr.city || 'N/A'}</p></div>
          <div><span className="text-[10px] text-muted-foreground">State</span><p>{addr.state || 'N/A'}</p></div>
          <div><span className="text-[10px] text-muted-foreground">Pincode</span><p>{addr.zipCode || 'N/A'}</p></div>
          <div><span className="text-[10px] text-muted-foreground">Phone</span><p>{addr.phoneNumber || 'N/A'}</p></div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Items ({items.length})</h3>
          <button onClick={() => downloadInvoice({ orderId: formatOrderNo(o.orderNumber) || String(o._id), customerName: String(addr.fullName || ''), customerPhone: String(addr.phoneNumber || ''), customerAddress: [addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '), items: items.map((i: Record<string, unknown>) => ({ name: String(i.name), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, gstRate: Number(i.gstRate) || 18 })) })} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Download className="h-3.5 w-3.5" /> Invoice</button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-surface/40 p-3">
              {item.image ? <img src={getImageUrl(String(item.image))} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center text-xs text-muted-foreground">IMG</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{String(item.name)}</p>
                <p className="text-xs text-muted-foreground">Qty: {String(item.quantity)} × {formatINR(Number(item.price) || 0)}</p>
              </div>
              <p className="font-display font-bold text-primary">{formatINR((Number(item.price) || 0) * (Number(item.quantity) || 1))}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-border mt-3 pt-3">
          <span className="font-bold uppercase tracking-wider">Total</span>
          <span className="font-display text-xl font-black text-primary">{formatINR(Number(o.totalPrice) || 0)}</span>
        </div>
      </div>
    </div>
  );
}
