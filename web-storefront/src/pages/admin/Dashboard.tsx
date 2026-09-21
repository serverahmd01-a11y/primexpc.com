import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo } from '@/lib/utils';
import { IndianRupee, Package, ShoppingBag, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0 });
  const [orders, setOrders] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.getOrders()])
      .then(([s, o]) => {
        setStats(s);
        setOrders((o.orders || []).slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { name: 'Total Revenue', value: formatINR(stats.totalRevenue), icon: IndianRupee },
    { name: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag },
    { name: 'Total Customers', value: stats.totalCustomers, icon: Users },
    { name: 'Total Products', value: stats.totalProducts, icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.name}</span>
              <c.icon className="h-5 w-5 text-primary/60" />
            </div>
            <div className="mt-2 font-display text-2xl font-black text-foreground">
              {loading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-black">Recent Orders</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(orders as Record<string, unknown>[]).map((o) => (
                  <tr key={String(o._id)} className="border-b border-border">
                    <td className="px-5 py-3 font-mono text-xs">#{formatOrderNo(o.orderNumber) || String(o._id).slice(-8).toUpperCase()}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{String((o.shippingAddress as Record<string, string>)?.fullName || 'N/A')}</div>
                    </td>
                    <td className="px-5 py-3">{String((o.orderItems as unknown[])?.length || 0)} item(s)</td>
                    <td className="px-5 py-3 font-bold text-primary">{formatINR(Number(o.totalPrice) || 0)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold capitalize ${
                        o.status === 'delivered' ? 'bg-primary/15 text-primary' :
                        o.status === 'shipped' ? 'bg-blue-500/15 text-blue-400' :
                        o.status === 'cancelled' ? 'bg-destructive/15 text-destructive' :
                        o.status === 'returned' ? 'bg-orange-500/15 text-orange-500' :
                        'bg-yellow-500/15 text-yellow-400'
                      }`}>{String(o.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
