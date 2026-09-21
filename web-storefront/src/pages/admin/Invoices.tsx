import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo, downloadInvoice } from '@/lib/utils';
import { Download, FileSpreadsheet, Eye, Loader2 } from 'lucide-react';
import { OrderFilterBar, applyOrderFilters, defaultFilters, downloadOrdersExcel, formatInvoiceNo, isCodOrder } from './orderFilters';
import type { OrderFilters } from './orderFilters';
import Pagination, { paginate, sortNewestFirst } from './Pagination';

export default function AdminInvoices() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = () => {
    Promise.all([adminApi.getOrders(), adminApi.getCustomers(), adminApi.getProducts()])
      .then(([o, c, p]) => {
        setOrders(o.orders || []);
        setCustomers(c.customers || []);
        setProducts(p || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const userOptions = useMemo(
    () => customers.map((c) => ({ value: String(c._id), label: `${String(c.name)} — ${String(c.email)}` })),
    [customers]
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ value: String(p.name), label: String(p.name) })),
    [products]
  );

  const filtered = useMemo(() => sortNewestFirst(applyOrderFilters(orders, filters)), [orders, filters]);
  const paged = paginate(filtered, page, perPage);

  useEffect(() => { setPage(1); }, [filters]);

  const totalSum = filtered.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
  const codCount = filtered.filter(isCodOrder).length;
  const prepaidCount = filtered.length - codCount;

  const handleExcel = () => downloadOrdersExcel(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black">Invoices</h2>
          <p className="text-sm text-muted-foreground">All invoices for CA / GST portal entries. Invoice No = Order No.</p>
        </div>
        <button
          onClick={handleExcel}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> Download Excel ({filtered.length})
        </button>
      </div>

      <OrderFilterBar filters={filters} setFilters={setFilters} users={userOptions} products={productOptions} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Orders</div>
          <div className="font-display text-lg font-black">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">COD</div>
          <div className="font-display text-lg font-black text-amber-600">{codCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prepaid</div>
          <div className="font-display text-lg font-black text-blue-400">{prepaidCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Value</div>
          <div className="font-display text-lg font-black text-primary">{formatINR(totalSum)}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No invoices match the selected filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Invoice No.</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Taxable</th>
                <th className="px-5 py-3">GST</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o) => {
                const items = (o.orderItems as Record<string, unknown>[]) || [];
                const addr = (o.shippingAddress as Record<string, string>) || {};
                const user = (o.user as Record<string, string>) || {};
                const total = Number(o.totalPrice) || 0;
                const itemTotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
                const taxable = items.reduce((s, it) => {
                  const t = (Number(it.price) || 0) * (Number(it.quantity) || 1);
                  return s + Math.round(t / (1 + (Number(it.gstRate) || 18) / 100));
                }, 0);
                const gst = Math.max(0, itemTotal - taxable);
                const invoiceNo = formatInvoiceNo(o.orderNumber, String(o._id));
                return (
                  <tr key={String(o._id)} className="border-b border-border hover:bg-surface/30">
                    <td className="px-5 py-3">
                      <Link to={`/admin/orders/${String(o._id)}`} className="font-mono text-xs font-bold text-primary hover:underline">
                        {invoiceNo}
                      </Link>
                      {!!o.isMissedOrder && <span className="ml-1 rounded bg-orange-500/15 px-1 py-0.5 text-[9px] font-bold text-orange-500">MISSED</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN') : ''}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{addr.fullName || user.name || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">{addr.phoneNumber || user.email || ''}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">{items.length} item(s)</td>
                    <td className="px-5 py-3">{formatINR(taxable)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatINR(gst)}</td>
                    <td className="px-5 py-3 font-bold text-primary">{formatINR(total)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${isCodOrder(o) ? 'bg-amber-500/15 text-amber-600' : 'bg-blue-500/15 text-blue-400'}`}>
                        {isCodOrder(o) ? 'COD' : 'Prepaid'}
                      </span>
                    </td>
                    <td className="px-5 py-3 capitalize text-xs">{String(o.status)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/admin/orders/${String(o._id)}`} className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                        <button
                          onClick={() => downloadInvoice({
                            orderId: formatOrderNo(o.orderNumber) || String(o._id),
                            customerName: String(addr.fullName || ''),
                            customerPhone: String(addr.phoneNumber || ''),
                            customerAddress: [addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
                            items: items.map((i) => ({ name: String(i.name), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, gstRate: Number(i.gstRate) || 18 })),
                          })}
                          className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          title="Download invoice PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
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
        total={filtered.length}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
