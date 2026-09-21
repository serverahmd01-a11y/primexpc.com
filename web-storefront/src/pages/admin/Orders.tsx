import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo, downloadInvoice, safeTrackingUrl, getImageUrl } from '@/lib/utils';
import { Download, FileSpreadsheet, ExternalLink, Package as PackageIcon, Save, Eye, Loader2 } from 'lucide-react';
import { OrderFilterBar, applyOrderFilters, defaultFilters, downloadOrdersExcel, isCodOrder } from './orderFilters';
import type { OrderFilters } from './orderFilters';
import { useAuth } from '@/lib/auth';
import Pagination, { paginate, sortNewestFirst } from './Pagination';

export default function AdminOrders() {
  const { user, isAdmin } = useAuth();
  const [orders, setOrders] = useState<unknown[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [trackInputs, setTrackInputs] = useState<Record<string, string>>({});
  const [savingTrack, setSavingTrack] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const canEdit = isAdmin || user?.role === 'shipping';

  const loadOrders = () => {
    Promise.all([adminApi.getOrders(), adminApi.getCustomers(), adminApi.getProducts(), adminApi.getOrderStats().catch(() => ({}))])
      .then(([o, c, p, s]) => {
        setOrders(o.orders || []);
        setCustomers(c.customers || []);
        setProducts(p || []);
        setStats(s as Record<string, number>);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!actionMsg) return;
    const t = setTimeout(() => setActionMsg(null), 3000);
    return () => clearTimeout(t);
  }, [actionMsg]);

  const userOptions = useMemo(
    () => customers.map((c) => ({ value: String(c._id), label: `${String(c.name)} — ${String(c.email)}` })),
    [customers]
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ value: String(p.name), label: String(p.name) })),
    [products]
  );

  const filteredOrders = useMemo(
    () => sortNewestFirst(applyOrderFilters((orders as Record<string, unknown>[]) || [], filters) as Record<string, unknown>[]),
    [orders, filters]
  );

  const pagedOrders = paginate(filteredOrders, page, perPage);

  useEffect(() => { setPage(1); }, [filters]);

  const patchOrder = (orderId: string, patch: Record<string, unknown>) => {
    setOrders((prev) => (prev as Record<string, unknown>[]).map((o) => o._id === orderId ? { ...o, ...patch } : o));
  };

  const updateStatus = async (orderId: string, status: string) => {
    if (!status) return;
    setUpdating(orderId);
    try {
      const res = await adminApi.updateOrderStatus(orderId, status);
      const saved = (res as { order?: Record<string, unknown> }).order;
      patchOrder(orderId, { status, shippedAt: saved?.shippedAt, deliveredAt: saved?.deliveredAt });
      setActionMsg({ type: 'success', text: 'Status updated' });
    } catch (e: unknown) {
      setActionMsg({ type: 'error', text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Status update failed' });
    }
    setUpdating(null);
  };

  const toggleAdvance = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const res = await adminApi.toggleAdvancePaid(orderId);
      patchOrder(orderId, { advancePaid: (res as { advancePaid: boolean }).advancePaid });
    } catch {
      setActionMsg({ type: 'error', text: 'Advance update failed' });
    }
    setUpdating(null);
  };

  const toggleBalance = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const res = await adminApi.markBalancePaid(orderId);
      patchOrder(orderId, { balancePaid: (res as { balancePaid: boolean }).balancePaid });
    } catch {
      setActionMsg({ type: 'error', text: 'Balance update failed' });
    }
    setUpdating(null);
  };

  const settle = async (orderId: string) => {
    if (!confirm('Mark this COD order as fully settled? (Advance + Balance received)')) return;
    setUpdating(orderId);
    try {
      await adminApi.settleOrder(orderId);
      patchOrder(orderId, { advancePaid: true, balancePaid: true, balancePaidAt: new Date().toISOString() });
      setActionMsg({ type: 'success', text: 'Order settled' });
    } catch {
      setActionMsg({ type: 'error', text: 'Settle failed' });
    }
    setUpdating(null);
  };

  const saveTracking = async (orderId: string) => {
    const link = (trackInputs[orderId] || '').trim();
    if (!link) return;
    setSavingTrack(orderId);
    try {
      await adminApi.updateOrderTracking(orderId, link);
      setTrackInputs((prev) => ({ ...prev, [orderId]: '' }));
      await loadOrders();
      setActionMsg({ type: 'success', text: 'Tracking saved' });
    } catch {
      setActionMsg({ type: 'error', text: 'Tracking save failed' });
    }
    setSavingTrack(null);
  };

  const StatBox = ({ label, value, color, detail }: { label: string; value: string | number; color: string; detail?: string }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-xl font-black ${color}`}>{value}</div>
      {detail && <div className="text-[10px] text-muted-foreground mt-0.5">{detail}</div>}
    </div>
  );

  const statusColor: Record<string, string> = {
    delivered: 'bg-primary/15 text-primary',
    shipped: 'bg-blue-500/15 text-blue-400',
    cancelled: 'bg-destructive/15 text-destructive',
    returned: 'bg-orange-500/15 text-orange-500',
    pending: 'bg-yellow-500/15 text-yellow-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black">Orders ({filteredOrders.length})</h2>
        <button
          onClick={() => downloadOrdersExcel(filteredOrders)}
          disabled={filteredOrders.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> Download Excel
        </button>
      </div>

      {actionMsg && (
        <div className={`rounded-lg border px-4 py-2.5 text-xs font-bold ${actionMsg.type === 'success' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
          {actionMsg.text}
        </div>
      )}

      <OrderFilterBar filters={filters} setFilters={setFilters} users={userOptions} products={productOptions} />

      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatBox label="Total Orders" value={stats.total} color="text-foreground" />
          <StatBox label="Prepaid" value={stats.prepaid || 0} color="text-primary" />
          <StatBox label="COD" value={stats.cod || 0} color="text-amber-400" />
          <StatBox label="Advance Paid" value={`${formatINR(stats.codTotalAdvance || 0)}`} color="text-emerald-400" detail={`${stats.codAdvancePaid || 0} orders`} />
          <StatBox label="Balance Pending" value={stats.codBalancePending || 0} color="text-amber-500" detail={`${formatINR((stats.codTotalValue || 0) - (stats.codTotalAdvance || 0))}`} />
          <StatBox label="Settled" value={stats.codSettled || 0} color="text-emerald-500" />
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No orders match the filters</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs min-w-[1080px]">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tracking</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((o) => {
                const items = (o.orderItems as Record<string, unknown>[]) || [];
                const addr = o.shippingAddress as Record<string, string> || {};
                const total = Number(o.totalPrice) || 0;
                const advance = Number(o.codAdvanceAmount) || 0;
                const balance = Math.max(0, total - advance);
                const trackUrl = safeTrackingUrl(o.trackingUrl);
                const isCod = isCodOrder(o);
                const orderId = String(o._id);
                const orderNumber = formatOrderNo(o.orderNumber) || orderId.slice(-8).toUpperCase();
                const createdAt = o.createdAt ? new Date(String(o.createdAt)) : null;
                const userName = String((o.user as Record<string,string>)?.name || 'N/A');
                const userEmail = String((o.user as Record<string,string>)?.email || '');
                const status = String(o.status);
                const busy = updating === orderId;
                const itemsSummary = items.map((i) => `${String(i.name)} ×${String(i.quantity)}`).join(', ');

                return (
                  <tr key={orderId} className="border-b border-border hover:bg-surface/30">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link to={`/admin/orders/${orderId}`} className="font-mono text-[11px] font-bold text-primary hover:underline">#{orderNumber}</Link>
                      <div className="text-[10px] text-muted-foreground">{createdAt ? createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="max-w-[130px] truncate font-semibold" title={`${addr.fullName || userName} • ${addr.phoneNumber || userEmail} • ${addr.city || ''} ${addr.zipCode || ''}`}>{addr.fullName || userName}</div>
                      <div className="max-w-[130px] truncate text-[10px] text-muted-foreground">{addr.phoneNumber || userEmail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[200px] truncate" title={itemsSummary}>
                        <span className="font-bold">{items.length} item{items.length !== 1 ? 's' : ''}:</span>{' '}
                        <span className="text-muted-foreground">{itemsSummary}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-display font-black text-primary">{formatINR(total)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${isCod ? 'bg-amber-500/15 text-amber-600' : 'bg-blue-500/15 text-blue-400'}`}>
                        {isCod ? 'COD' : 'Prepaid'}
                      </span>
                      {isCod && advance > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            onClick={() => toggleAdvance(orderId)}
                            disabled={busy || !isAdmin}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${o.advancePaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-500'} ${isAdmin ? 'hover:brightness-125' : 'cursor-default'}`}
                            title={`Advance ${formatINR(advance)} — ${o.advancePaid ? 'Paid' : 'Pending'} (toggle)`}
                          >
                            {o.advancePaid ? '✓' : '⏳'} Adv
                          </button>
                          <button
                            onClick={() => toggleBalance(orderId)}
                            disabled={busy}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${o.balancePaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-500'} hover:brightness-125`}
                            title={`Balance ${formatINR(balance)} — ${o.balancePaid ? 'Paid' : 'Pending'} (toggle)`}
                          >
                            {o.balancePaid ? '✓' : '⏳'} Bal
                          </button>
                          <button
                            onClick={() => settle(orderId)}
                            disabled={busy}
                            className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary hover:bg-primary/25 transition"
                            title="Settle All (advance + balance paid)"
                          >
                            {busy ? '...' : 'All'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <select
                        value={status}
                        onChange={(e) => updateStatus(orderId, e.target.value)}
                        disabled={busy || !canEdit}
                        className={`w-24 rounded border border-border bg-surface px-1.5 py-1 text-[10px] font-bold outline-none focus:ring-2 focus:ring-primary/40 ${statusColor[status] || ''} ${canEdit ? '' : 'cursor-default opacity-70'}`}
                        title={canEdit ? 'Change order status' : 'Admin/Shipping only'}
                      >
                        <option value="pending" className="bg-background text-yellow-400">Pending</option>
                        <option value="shipped" className="bg-background text-blue-400">Shipped</option>
                        <option value="delivered" className="bg-background text-primary">Delivered</option>
                        <option value="cancelled" className="bg-background text-destructive">Cancelled</option>
                        <option value="returned" className="bg-background text-orange-500">Returned</option>
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        {trackUrl && (
                          <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Open tracking">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <input
                          type="url"
                          value={trackInputs[orderId] || ''}
                          onChange={(e) => setTrackInputs((prev) => ({ ...prev, [orderId]: e.target.value }))}
                          placeholder="link..."
                          className="h-7 w-28 rounded border border-border bg-input px-1.5 text-[10px] outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => saveTracking(orderId)}
                          disabled={savingTrack === orderId || !(trackInputs[orderId] || '').trim()}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40"
                          title="Save tracking URL"
                        >
                          {savingTrack === orderId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            downloadInvoice({
                              orderId: orderNumber,
                              customerName: String(addr.fullName || ''),
                              customerPhone: String(addr.phoneNumber || ''),
                              customerAddress: [addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
                              items: items.map((i: Record<string, unknown>) => ({ name: String(i.name), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, gstRate: Number(i.gstRate) || 18 })),
                            });
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded border border-border text-primary hover:bg-primary/10"
                          title="Download invoice"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <Link to={`/admin/orders/${orderId}`} className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:text-primary hover:bg-primary/5" title="View details">
                          <Eye className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        total={filteredOrders.length}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
