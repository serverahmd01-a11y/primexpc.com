import { useEffect, useMemo, useState } from 'react';
import { adminApi, sellApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo } from '@/lib/utils';
import { FileSpreadsheet, FileText, Loader2, RefreshCw, Calendar, BarChart3, Package, IndianRupee, Users, Boxes, Coins } from 'lucide-react';
import { jsPDF } from 'jspdf';

type AnyRec = Record<string, unknown>;
const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monthStartIST = () => `${todayIST().slice(0, 7)}-01`;

// ---------- export helpers ----------

function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(filename: string, title: string, subtitle: string, headers: string[], rows: (string | number)[][], colWidths: number[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const scale = (pageW - 16) / totalW;
  const widths = colWidths.map((w) => w * scale);
  const x0 = 8;
  let y = 14;

  const drawHeader = () => {
    doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text(title, x0, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(110);
    doc.text(subtitle, x0, y + 5);
    doc.setTextColor(0);
    y += 11;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setFillColor(16, 185, 129); doc.setTextColor(255);
    let x = x0;
    headers.forEach((h, i) => { doc.rect(x, y, widths[i], 6, 'F'); doc.text(String(h), x + 1.5, y + 4, { maxWidth: widths[i] - 3 }); x += widths[i]; });
    doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    y += 6;
  };

  drawHeader();
  rows.forEach((row) => {
    if (y > pageH - 10) { doc.addPage(); y = 14; drawHeader(); }
    let x = x0;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), x + 1.5, y + 4, { maxWidth: widths[i] - 3 });
      x += widths[i];
    });
    doc.setDrawColor(230); doc.line(x0, y + 5.5, x0 + widths.reduce((s, w) => s + w, 0), y + 5.5);
    y += 6;
  });

  doc.setFontSize(8); doc.setTextColor(130);
  doc.text(`Generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · PrimeX PC`, x0, pageH - 5);
  doc.save(`${filename}.pdf`);
}

// ---------- page ----------

export default function AdminReports() {
  const [orders, setOrders] = useState<AnyRec[]>([]);
  const [customers, setCustomers] = useState<AnyRec[]>([]);
  const [products, setProducts] = useState<AnyRec[]>([]);
  const [leads, setLeads] = useState<AnyRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthStartIST());
  const [to, setTo] = useState(todayIST());

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.getOrders(), adminApi.getCustomers(), adminApi.getProducts(), sellApi.adminGetLeads('all')])
      .then(([o, c, p, l]) => {
        setOrders(o.orders || []);
        setCustomers(c.customers || []);
        setProducts(Array.isArray(p) ? p : (p.products || []));
        setLeads(Array.isArray(l) ? l : (l.leads || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const inRange = (o: AnyRec) => {
    const t = o.createdAt ? new Date(String(o.createdAt)).getTime() : 0;
    return t >= new Date(`${from}T00:00:00`).getTime() && t <= new Date(`${to}T23:59:59`).getTime();
  };
  const rangeOrders = useMemo(() => orders.filter(inRange), [orders, from, to]);
  const activeOrders = useMemo(() => rangeOrders.filter((o) => !['cancelled', 'returned'].includes(String(o.status))), [rangeOrders]);

  const salesRows = useMemo(() => {
    const byDay = new Map<string, { count: number; revenue: number; cod: number; prepaid: number }>();
    for (const o of activeOrders) {
      const day = new Date(String(o.createdAt)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const e = byDay.get(day) || { count: 0, revenue: 0, cod: 0, prepaid: 0 };
      e.count++; e.revenue += Number(o.totalPrice) || 0;
      (o.paymentResult as AnyRec)?.status === 'cod_advance' ? e.cod++ : e.prepaid++;
      byDay.set(day, e);
    }
    return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([day, e]) => [day, e.count, e.prepaid, e.cod, e.revenue]);
  }, [activeOrders]);

  const salesTotals = useMemo(() => ({
    count: activeOrders.length,
    revenue: activeOrders.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0),
    cod: activeOrders.filter((o) => (o.paymentResult as AnyRec)?.status === 'cod_advance').length,
    codPending: orders.filter((o) => (o.paymentResult as AnyRec)?.status === 'cod_advance' && !o.balancePaid && !['cancelled', 'returned'].includes(String(o.status)))
      .reduce((s, o) => s + ((Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0)), 0),
  }), [activeOrders, orders]);

  const isLow = (stock: unknown) => Number(stock) <= 3;

  const REPORTS = [
    {
      key: 'sales', icon: BarChart3, title: 'Sales Summary',
      desc: `Day-by-day business for ${from} → ${to} — orders, COD/prepaid split, revenue. (Range: ${salesTotals.count} orders, ${formatINR(salesTotals.revenue)})`,
      run: () => {
        const headers = ['Date', 'Orders', 'Prepaid', 'COD', 'Revenue (₹)'];
        const rows = [...salesRows, ['TOTAL', salesTotals.count, salesTotals.count - salesTotals.cod, salesTotals.cod, salesTotals.revenue]];
        return { headers, rows, widths: [40, 20, 20, 20, 30], fileBase: `sales-summary-${from}-to-${to}`, title: `Sales Summary: ${from} to ${to}`, subtitle: `${salesTotals.count} orders · Revenue ${formatINR(salesTotals.revenue)} · COD balance pending ${formatINR(salesTotals.codPending)}` };
      },
    },
    {
      key: 'orders', icon: Package, title: 'Orders Detail',
      desc: `Every order in ${from} → ${to} with customer, payment and item details.`,
      run: () => {
        const headers = ['Order No', 'Date', 'Customer', 'Phone', 'City', 'Type', 'Status', 'Total (₹)'];
        const rows = rangeOrders.map((o) => {
          const a = (o.shippingAddress as AnyRec) || {};
          return [
            formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(),
            o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN') : '',
            String(a.fullName || '-'),
            String(a.phoneNumber || '-'),
            String(a.city || '-'),
            (o.paymentResult as AnyRec)?.status === 'cod_advance' ? 'COD' : 'Prepaid',
            String(o.status),
            Number(o.totalPrice) || 0,
          ];
        });
        return { headers, rows, widths: [18, 20, 34, 22, 20, 14, 18, 22], fileBase: `orders-${from}-to-${to}`, title: `Orders: ${from} to ${to}`, subtitle: `${rows.length} orders` };
      },
    },
    {
      key: 'cod', icon: IndianRupee, title: 'COD Pending Payments',
      desc: `All COD orders where balance payment is still pending. (Pending balance: ${formatINR(salesTotals.codPending)})`,
      run: () => {
        const headers = ['Order No', 'Date', 'Customer', 'Phone', 'Advance (₹)', 'Balance (₹)', 'Status'];
        const rows = orders
          .filter((o) => (o.paymentResult as AnyRec)?.status === 'cod_advance' && !o.balancePaid && !['cancelled', 'returned'].includes(String(o.status)))
          .map((o) => {
            const a = (o.shippingAddress as AnyRec) || {};
            return [
              formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(),
              o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN') : '',
              String(a.fullName || '-'),
              String(a.phoneNumber || '-'),
              Number(o.codAdvanceAmount) || 0,
              (Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0),
              String(o.status),
            ];
          });
        return { headers, rows, widths: [20, 20, 34, 22, 22, 22, 18], fileBase: 'cod-pending-payments', title: 'COD Pending Payments', subtitle: `${rows.length} orders · Balance pending ${formatINR(salesTotals.codPending)}` };
      },
    },
    {
      key: 'customers', icon: Users, title: 'Customers',
      desc: 'All customers with their order count and total spend.',
      run: () => {
        const stats = new Map<string, { count: number; total: number }>();
        for (const o of orders) {
          if (['cancelled', 'returned'].includes(String(o.status))) continue;
          const u = o.user as AnyRec | string | undefined;
          const uid = String((u && typeof u === 'object' && u._id) ? u._id : u || '');
          if (!uid) continue;
          const e = stats.get(uid) || { count: 0, total: 0 };
          e.count++; e.total += Number(o.totalPrice) || 0;
          stats.set(uid, e);
        }
        const headers = ['Name', 'Email', 'Joined', 'Orders', 'Total Spend (₹)'];
        const rows = customers.map((c) => {
          const s = stats.get(String(c._id)) || { count: 0, total: 0 };
          return [String(c.name || '-'), String(c.email || '-'), c.createdAt ? new Date(String(c.createdAt)).toLocaleDateString('en-IN') : '', s.count, s.total];
        }).sort((a, b) => Number(b[4]) - Number(a[4]));
        return { headers, rows, widths: [34, 48, 22, 16, 26], fileBase: 'customers', title: 'Customers', subtitle: `${rows.length} customers` };
      },
    },
    {
      key: 'stock', icon: Boxes, title: 'Stock / Inventory',
      desc: 'All products with price and stock — low stock (≤3) flagged. Great before restocking.',
      run: () => {
        const headers = ['Product', 'Category', 'Condition', 'Price (₹)', 'Sale Price (₹)', 'Stock', 'Flag'];
        const rows = products.map((p) => [
          String(p.name || '-'),
          String(p.category || '-'),
          String(p.condition || 'new'),
          Number(p.price) || 0,
          Number(p.salePrice) || 0,
          Number(p.stock) || 0,
          isLow(p.stock) ? 'LOW STOCK' : '',
        ]).sort((a, b) => Number(a[5]) - Number(b[5]));
        return { headers, rows, widths: [48, 26, 18, 20, 22, 14, 18], fileBase: 'stock-inventory', title: 'Stock / Inventory', subtitle: `${rows.length} products · ${rows.filter((r) => r[6]).length} low on stock` };
      },
    },
    {
      key: 'sell', icon: Coins, title: 'Sell Leads',
      desc: 'Customers selling their GPUs — products offered, expected prices and status.',
      run: () => {
        const headers = ['Request', 'Date', 'Customer', 'Mobile', 'Products', 'Expected (₹)', 'Offered (₹)', 'Status'];
        const rows = leads.map((l) => {
          const prods = (l.products as AnyRec[]) || [];
          return [
            `#${String(l._id).slice(-6).toUpperCase()}`,
            l.createdAt ? new Date(String(l.createdAt)).toLocaleDateString('en-IN') : '',
            String(l.customerName || '-'),
            String(l.customerMobile || '-'),
            prods.map((p) => `${p.brand} ${p.model}`).join('; ').slice(0, 60),
            prods.reduce((s, p) => s + (Number(p.expectedPrice) || 0), 0),
            Number(l.offeredPrice) || 0,
            String(l.status || '-'),
          ];
        });
        return { headers, rows, widths: [18, 20, 30, 22, 56, 20, 20, 20], fileBase: 'sell-leads', title: 'Sell Leads', subtitle: `${rows.length} requests` };
      },
    },
  ];

  const doExport = (r: typeof REPORTS[number], kind: 'excel' | 'pdf') => {
    const data = r.run();
    if (data.rows.length === 0) { alert('No data in this range for this report.'); return; }
    if (kind === 'excel') downloadCsv(data.fileBase, data.headers, data.rows);
    else downloadPdf(data.fileBase, data.title, data.subtitle, data.headers, data.rows, data.widths);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Download any report as Excel (CSV) or PDF.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-4 w-4 text-primary" /> Date range (order reports)
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground" />
        </div>
        <div className="flex gap-2 text-[11px] font-bold">
          <button onClick={() => { setFrom(todayIST()); setTo(todayIST()); }} className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary">Today</button>
          <button onClick={() => { setFrom(monthStartIST()); setTo(todayIST()); }} className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary">This Month</button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> Loading data...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {REPORTS.map((r) => (
            <div key={r.key} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><r.icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <h3 className="font-display text-base font-black">{r.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => doExport(r, 'excel')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
                <button onClick={() => doExport(r, 'pdf')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-primary/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10">
                  <FileText className="h-4 w-4" /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
