import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { orderApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo, getImageUrl, downloadInvoice, safeTrackingUrl } from '@/lib/utils';
import { Package, Download, CheckCircle2, Clock } from 'lucide-react';

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    orderApi.getAll().then((d) => setOrders(d.orders || [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-black">My Orders</h1>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Package className="h-8 w-8" /></div>
            <h2 className="mt-4 font-display text-lg font-bold">No orders yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start shopping to see your orders here.</p>
            <Link to="/" className="mt-4 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">Shop Now</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((o) => {
              const items = (o.orderItems as Record<string, unknown>[]) || [];
              const total = Number(o.totalPrice) || 0;
              const advance = Number(o.codAdvanceAmount) || 0;
              const balance = Math.max(0, total - advance);
              const isCod = (o.paymentResult as Record<string, string>)?.status === 'cod_advance';
              const statusBadge = (s: string) => {
                switch (s) {
                  case 'delivered': return 'bg-primary/15 text-primary';
                  case 'shipped': return 'bg-blue-500/15 text-blue-400';
                  case 'cancelled': return 'bg-destructive/15 text-destructive';
                  case 'returned': return 'bg-orange-500/15 text-orange-500';
                  default: return 'bg-yellow-500/15 text-yellow-400';
                }
              };
              return (
                <div key={String(o._id)} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-surface/40 px-3 py-3 sm:px-5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order</span>
                      <span className="ml-2 font-mono text-sm font-bold">#{formatOrderNo(o.orderNumber) || String(o._id).slice(-8).toUpperCase()}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">{o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusBadge(String(o.status))}`}>{String(o.status)}</span>
                      {safeTrackingUrl(o.trackingUrl) ? (
                        <a href={safeTrackingUrl(o.trackingUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-400 hover:bg-blue-500/25">
                          <Package className="h-3 w-3" /> Track Order
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="space-y-3">
                      {(items as Record<string, unknown>[]).map((item, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-surface to-background">
                            {item.image ? <img src={getImageUrl(String(item.image))} alt="" className="h-full w-full object-cover rounded-lg" /> : <Package className="h-5 w-5 text-primary/60" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-bold">{String(item.name)}</div>
                            <div className="text-xs text-muted-foreground">Qty: {String(item.quantity)} × {formatINR(Number(item.price) || 0)}</div>
                          </div>
                          <div className="font-display font-bold text-primary">{formatINR((Number(item.price) || 0) * (Number(item.quantity) || 1))}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-sm text-muted-foreground">{items.length} item(s)</span>
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.preventDefault(); const sa = o.shippingAddress as Record<string, string> || {}; downloadInvoice({ orderId: formatOrderNo(o.orderNumber) || String(o._id), customerName: String(sa.fullName || ''), customerPhone: String(sa.phoneNumber || ''), customerAddress: [sa.streetAddress, sa.city, sa.state, sa.zipCode].filter(Boolean).join(', '), items: items.map((i: Record<string, unknown>) => ({ name: String(i.name), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, gstRate: Number(i.gstRate) || 18 })) }); }} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Download className="h-3.5 w-3.5" /> Invoice</button>
                        <span className="font-display text-lg font-black text-primary">{formatINR(total)}</span>
                      </div>
                    </div>

                    {isCod && advance > 0 && (
                      <div className="mt-3 rounded-lg border border-border bg-surface/40 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            {o.advancePaid
                              ? <CheckCircle2 className="h-4 w-4 text-primary" />
                              : <Clock className="h-4 w-4 text-amber-500" />}
                            <span className="font-bold text-muted-foreground">Advance Paid 25%</span>
                            <span className="font-bold">{formatINR(advance)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {o.balancePaid
                              ? <CheckCircle2 className="h-4 w-4 text-primary" />
                              : <Clock className="h-4 w-4 text-amber-500" />}
                            <span className="font-bold text-muted-foreground">Balance Pending 75%</span>
                            <span className="font-bold">{formatINR(balance)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}