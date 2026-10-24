import { useEffect, useMemo, useState } from 'react';
import { adminApi, sellApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo } from '@/lib/utils';
import { FileSpreadsheet, FileText, Loader2, RefreshCw, Calendar, BarChart3, Package, IndianRupee, Users, Boxes, Coins, Trophy, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import Pagination, { paginate } from './Pagination';

type AnyRec = Record<string, unknown>;
type Row = (string | number)[];
type Col = { h: string; w: number; right?: boolean };

const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monthStartIST = () => `${todayIST().slice(0, 7)}-01`;
const d = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('en-IN') : '');

// ---------- export helpers ----------

function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: Row[]) {
  const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(filename: string, title: string, subtitle: string, headers: string[], rows: Row[], colWidths: number[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const widths = colWidths.map((w) => (w / colWidths.reduce((s, x) => s + x, 0)) * (pageW - 16));
  const x0 = 8;
  let y = 14;

  const drawHead = () => {
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

  drawHead();
  rows.forEach((row) => {
    if (y > pageH - 10) { doc.addPage(); y = 14; drawHead(); }
    let x = x0;
    row.forEach((cell, i) => { doc.text(String(cell ?? ''), x + 1.5, y + 4, { maxWidth: widths[i] - 3 }); x += widths[i]; });
    doc.setDrawColor(230); doc.line(x0, y + 5.5, x0 + widths.reduce((s, w) => s + w, 0), y + 5.5);
    y += 6;
  });

  doc.setFontSize(8); doc.setTextColor(130);
  doc.text(`Generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · PrimeX PC`, x0, pageH - 5);
  doc.save(`${filename}.pdf`);
}

// ---------- page ----------

const REPORT_TABS = [
  { key: 'sales', label: 'Sales Summary', icon: BarChart3 },
  { key: 'top', label: 'Top Products', icon: Trophy },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'cod', label: 'COD Pending', icon: IndianRupee },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'stock', label: 'Stock', icon: Boxes },
  { key: 'sell', label: 'Sell Leads', icon: Coins },
] as const;
type ReportKey = typeof REPORT_TABS[number]['key'];

export default function AdminReports() {
  const [orders, setOrders] = useState<AnyRec[]>([]);
  const [customers, setCustomers] = useState<AnyRec[]>([]);
  const [products, setProducts] = useState<AnyRec[]>([]);
  const [leads, setLeads] = useState<AnyRec[]>([]);
  const [loading, setLoading] = useState(true);

  const [report, setReport] = useState<ReportKey>('sales');
  const [from, setFrom] = useState(monthStartIST());
  const [to, setTo] = useState(todayIST());
  const [status, setStatus] = useState('all');
  const [payType, setPayType] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [sellStatus, setSellStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

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
  useEffect(() => { setPage(1); }, [report, from, to, status, payType, search, onlyLow, sellStatus]);

  const inRange = (o: AnyRec) => {
    const t = o.createdAt ? new Date(String(o.createdAt)).getTime() : 0;
    return t >= new Date(`${from}T00:00:00`).getTime() && t <= new Date(`${to}T23:59:59`).getTime();
  };
  const isCod = (o: AnyRec) => (o.paymentResult as AnyRec)?.status === 'cod_advance';
  const active = (o: AnyRec) => !['cancelled', 'returned'].includes(String(o.status));

  // ---------- report definitions (all memoized on filters) ----------

  const rangeOrders = useMemo(() => orders.filter((o) => inRange(o)
    && (status === 'all' || String(o.status) === status)
    && (payType === 'all' || (payType === 'cod') === isCod(o))), [orders, from, to, status, payType]);

  const rangeActive = useMemo(() => rangeOrders.filter(active), [rangeOrders]);

  const { stats, cols, rows, title } = useMemo(() => {
    if (report === 'sales') {
      const byDay = new Map<string, { count: number; revenue: number; cod: number; prepaid: number }>();
      for (const o of rangeActive) {
        const day = new Date(String(o.createdAt)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const e = byDay.get(day) || { count: 0, revenue: 0, cod: 0, prepaid: 0 };
        e.count++; e.revenue += Number(o.totalPrice) || 0;
        isCod(o) ? e.cod++ : e.prepaid++;
        byDay.set(day, e);
      }
      const rev = rangeActive.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
      const codCount = rangeActive.filter(isCod).length;
      const pending = orders.filter((o) => isCod(o) && !o.balancePaid && active(o))
        .reduce((s, o) => s + ((Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0)), 0);
      const rowsOut: Row[] = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]))
        .map(([day, e]) => [day, e.count, e.prepaid, e.cod, e.revenue]);
      return {
        title: `Sales Summary (${from} → ${to})`,
        stats: [
          { label: 'Orders', value: String(rangeActive.length) },
          { label: 'Revenue', value: formatINR(rev) },
          { label: 'Prepaid', value: `${rangeActive.length - codCount}` },
          { label: 'COD', value: `${codCount}` },
          { label: 'Avg Order', value: formatINR(rangeActive.length ? Math.round(rev / rangeActive.length) : 0) },
          { label: 'COD Balance Due', value: formatINR(pending) },
        ],
        cols: [{ h: 'Date', w: 110 }, { h: 'Orders', w: 70, right: true }, { h: 'Prepaid', w: 70, right: true }, { h: 'COD', w: 60, right: true }, { h: 'Revenue', w: 100, right: true }] as Col[],
        rows: [...rowsOut, ['TOTAL', rangeActive.length, rangeActive.length - codCount, codCount, rev]],
      };
    }

    if (report === 'top') {
      const map = new Map<string, { qty: number; revenue: number; orders: number }>();
      for (const o of rangeActive) {
        for (const it of (o.orderItems as AnyRec[]) || []) {
          const name = String(it.name || '-');
          const e = map.get(name) || { qty: 0, revenue: 0, orders: 0 };
          e.qty += Number(it.quantity) || 0;
          e.revenue += (Number(it.price) || 0) * (Number(it.quantity) || 0);
          e.orders++;
          map.set(name, e);
        }
      }
      const list = Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
      return {
        title: `Top Products (${from} → ${to})`,
        stats: [
          { label: 'Products Sold', value: String(list.length) },
          { label: 'Total Units', value: String(list.reduce((s, [, e]) => s + e.qty, 0)) },
          { label: 'Product Revenue', value: formatINR(list.reduce((s, [, e]) => s + e.revenue, 0)) },
          { label: 'Best Seller', value: list[0] ? `${list[0][0].slice(0, 22)} (${list[0][1].qty})` : '-' },
        ],
        cols: [{ h: '#', w: 40 }, { h: 'Product', w: 260 }, { h: 'Units', w: 70, right: true }, { h: 'Orders', w: 70, right: true }, { h: 'Revenue', w: 100, right: true }] as Col[],
        rows: list.map(([name, e], i) => [i + 1, name, e.qty, e.orders, e.revenue]),
      };
    }

    if (report === 'orders') {
      const q = search.toLowerCase();
      const list = rangeOrders.filter((o) => {
        if (!q) return true;
        const a = (o.shippingAddress as AnyRec) || {};
        const items = ((o.orderItems as AnyRec[]) || []).map((i) => String(i.name || '')).join(' ').toLowerCase();
        return [a.fullName, a.phoneNumber, a.city, o._id].some((v) => String(v || '').toLowerCase().includes(q)) || items.includes(q);
      });
      const rev = list.filter(active).reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
      return {
        title: `Orders (${from} → ${to})`,
        stats: [
          { label: 'Orders', value: String(list.length) },
          { label: 'Active Revenue', value: formatINR(rev) },
          { label: 'Cancelled/Returned', value: String(list.length - list.filter(active).length) },
        ],
        cols: [
          { h: 'Order No', w: 80 }, { h: 'Date', w: 90 }, { h: 'Customer', w: 150 }, { h: 'Phone', w: 100 },
          { h: 'City', w: 90 }, { h: 'Items', w: 50, right: true }, { h: 'Type', w: 65 }, { h: 'Status', w: 85 }, { h: 'Total', w: 90, right: true },
        ] as Col[],
        rows: list.map((o) => {
          const a = (o.shippingAddress as AnyRec) || {};
          return [
            formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(),
            d(o.createdAt),
            String(a.fullName || '-'),
            String(a.phoneNumber || '-'),
            String(a.city || '-'),
            ((o.orderItems as AnyRec[]) || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
            isCod(o) ? 'COD' : 'Prepaid',
            String(o.status),
            Number(o.totalPrice) || 0,
          ];
        }),
      };
    }

    if (report === 'cod') {
      const list = orders.filter((o) => isCod(o) && !o.balancePaid && active(o));
      const totalDue = list.reduce((s, o) => s + ((Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0)), 0);
      const oldest = list.reduce((m, o) => Math.max(m, Math.floor((Date.now() - new Date(String(o.createdAt)).getTime()) / 86400000)), 0);
      return {
        title: 'COD Pending Payments',
        stats: [
          { label: 'Orders Pending', value: String(list.length) },
          { label: 'Balance Due', value: formatINR(totalDue) },
          { label: 'Oldest', value: `${oldest} days` },
        ],
        cols: [
          { h: 'Order No', w: 80 }, { h: 'Date', w: 90 }, { h: 'Customer', w: 150 }, { h: 'Phone', w: 100 },
          { h: 'Advance', w: 85, right: true }, { h: 'Balance', w: 85, right: true }, { h: 'Age', w: 55, right: true }, { h: 'Status', w: 85 },
        ] as Col[],
        rows: list.map((o) => {
          const a = (o.shippingAddress as AnyRec) || {};
          return [
            formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(),
            d(o.createdAt),
            String(a.fullName || '-'),
            String(a.phoneNumber || '-'),
            Number(o.codAdvanceAmount) || 0,
            (Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0),
            `${Math.floor((Date.now() - new Date(String(o.createdAt)).getTime()) / 86400000)}d`,
            String(o.status),
          ];
        }),
      };
    }

    if (report === 'customers') {
      const stats2 = new Map<string, { count: number; total: number; last: number }>();
      for (const o of orders) {
        if (!active(o)) continue;
        const u = o.user as AnyRec | string | undefined;
        const uid = String((u && typeof u === 'object' && u._id) ? u._id : u || '');
        if (!uid) continue;
        const e = stats2.get(uid) || { count: 0, total: 0, last: 0 };
        e.count++; e.total += Number(o.totalPrice) || 0;
        e.last = Math.max(e.last, o.createdAt ? new Date(String(o.createdAt)).getTime() : 0);
        stats2.set(uid, e);
      }
      const q = search.toLowerCase();
      const list = customers
        .map((c) => {
          const s = stats2.get(String(c._id)) || { count: 0, total: 0, last: 0 };
          return { c, s };
        })
        .filter(({ c, s }) => s.count > 0 && (!q || String(c.name || '').toLowerCase().includes(q) || String(c.email || '').toLowerCase().includes(q)))
        .sort((a, b) => b.s.total - a.s.total);
      return {
        title: 'Customers (with orders)',
        stats: [
          { label: 'Customers', value: String(list.length) },
          { label: 'Total Spend', value: formatINR(list.reduce((s, x) => s + x.s.total, 0)) },
          { label: 'Best Customer', value: list[0] ? `${String(list[0].c.name || '-').slice(0, 20)} (${formatINR(list[0].s.total)})` : '-' },
        ],
        cols: [
          { h: '#', w: 40 }, { h: 'Name', w: 170 }, { h: 'Email', w: 210 }, { h: 'Joined', w: 90 },
          { h: 'Orders', w: 60, right: true }, { h: 'Spend', w: 95, right: true }, { h: 'Last Order', w: 90 },
        ] as Col[],
        rows: list.map(({ c, s }, i) => [i + 1, String(c.name || '-'), String(c.email || '-'), d(c.createdAt), s.count, s.total, s.last ? d(new Date(s.last)) : '-']),
      };
    }

    if (report === 'stock') {
      const q = search.toLowerCase();
      const list = products
        .filter((p) => (!onlyLow || Number(p.stock) <= 3) && (!q || String(p.name || '').toLowerCase().includes(q) || String(p.category || '').toLowerCase().includes(q)))
        .sort((a, b) => Number(a.stock) - Number(b.stock));
      const value = list.reduce((s, p) => s + (Number(p.salePrice) || Number(p.price) || 0) * (Number(p.stock) || 0), 0);
      return {
        title: 'Stock / Inventory',
        stats: [
          { label: 'Products', value: String(list.length) },
          { label: 'Stock Value', value: formatINR(value) },
          { label: 'Low Stock (≤3)', value: String(list.filter((p) => Number(p.stock) <= 3).length) },
          { label: 'Out of Stock', value: String(list.filter((p) => Number(p.stock) <= 0).length) },
        ],
        cols: [
          { h: 'Product', w: 260 }, { h: 'Category', w: 120 }, { h: 'Condition', w: 85 },
          { h: 'Price', w: 80, right: true }, { h: 'Sale Price', w: 85, right: true }, { h: 'Stock', w: 60, right: true }, { h: 'Stock Value', w: 95, right: true }, { h: 'Flag', w: 90 },
        ] as Col[],
        rows: list.map((p) => [
          String(p.name || '-'),
          String(p.category || '-'),
          String(p.condition || 'new'),
          Number(p.price) || 0,
          Number(p.salePrice) || 0,
          Number(p.stock) || 0,
          (Number(p.salePrice) || Number(p.price) || 0) * (Number(p.stock) || 0),
          Number(p.stock) <= 0 ? 'OUT OF STOCK' : Number(p.stock) <= 3 ? 'LOW STOCK' : '',
        ]),
      };
    }

    // sell leads
    const list = leads
      .filter((l) => (sellStatus === 'all' || String(l.status) === sellStatus) && inRange(l))
      .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    const completedValue = list.filter((l) => ['paid', 'completed'].includes(String(l.status))).reduce((s, l) => s + (Number(l.offeredPrice) || 0), 0);
    return {
      title: 'Sell Leads',
      stats: [
        { label: 'Requests', value: String(list.length) },
        { label: 'Completed Value', value: formatINR(completedValue) },
        { label: 'Awaiting Offer', value: String(list.filter((l) => ['new', 'contacted'].includes(String(l.status))).length) },
      ],
      cols: [
        { h: 'Request', w: 75 }, { h: 'Date', w: 85 }, { h: 'Customer', w: 130 }, { h: 'Mobile', w: 95 },
        { h: 'Products', w: 240 }, { h: 'Expected', w: 85, right: true }, { h: 'Offered', w: 85, right: true }, { h: 'Status', w: 95 },
      ] as Col[],
      rows: list.map((l) => {
        const prods = (l.products as AnyRec[]) || [];
        return [
          `#${String(l._id).slice(-6).toUpperCase()}`,
          d(l.createdAt),
          String(l.customerName || '-'),
          String(l.customerMobile || '-'),
          prods.map((p) => `${p.brand} ${p.model}`).join('; '),
          prods.reduce((s, p) => s + (Number(p.expectedPrice) || 0), 0),
          Number(l.offeredPrice) || 0,
          String(l.status || '-'),
        ];
      }),
    };
  }, [report, rangeActive, rangeOrders, orders, customers, products, leads, from, to, search, onlyLow, sellStatus]);

  const exportData = (kind: 'excel' | 'pdf') => {
    if (rows.length === 0) { alert('Nothing to download with these filters.'); return; }
    const headers = cols.map((c) => c.h);
    const widths = cols.map((c) => c.w);
    const fileBase = `${report}-report-${todayIST()}`;
    const subtitle = stats.map((s) => `${s.label}: ${s.value}`).join('  ·  ');
    if (kind === 'excel') downloadCsv(fileBase, headers, rows);
    else downloadPdf(fileBase, title, subtitle, headers, rows, widths);
  };

  const paged = paginate(rows as unknown as Record<string, unknown>[], page, perPage) as unknown as Row[];
  const usesDateRange = ['sales', 'top', 'orders', 'sell'].includes(report);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">View with your filters, then download exactly what you see.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => exportData('excel')} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button onClick={() => exportData('pdf')} className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10">
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {/* report tabs */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((t) => (
          <button key={t.key} onClick={() => setReport(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${report === t.key ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        {usesDateRange && (
          <>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground"><Calendar className="h-3 w-3 text-primary" /> From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground" />
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { setFrom(todayIST()); setTo(todayIST()); }} className="h-9 rounded-full border border-border px-3 text-[11px] font-bold text-muted-foreground hover:border-primary hover:text-primary">Today</button>
              <button onClick={() => { setFrom(monthStartIST()); setTo(todayIST()); }} className="h-9 rounded-full border border-border px-3 text-[11px] font-bold text-muted-foreground hover:border-primary hover:text-primary">This Month</button>
            </div>
          </>
        )}
        {report === 'orders' && (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-2 text-xs font-bold text-foreground">
                {['all', 'pending', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Payment</label>
              <select value={payType} onChange={(e) => setPayType(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-2 text-xs font-bold text-foreground">
                <option value="all">All Payments</option>
                <option value="cod">COD only</option>
                <option value="prepaid">Prepaid only</option>
              </select>
            </div>
          </>
        )}
        {['orders', 'customers', 'stock'].includes(report) && (
          <div className="relative min-w-[200px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={report === 'stock' ? 'Product / category...' : 'Name / email / phone / product...'} className="h-9 w-full rounded-lg border border-border bg-input pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary" />
            </div>
          </div>
        )}
        {report === 'stock' && (
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="h-4 w-4 accent-primary" />
            Low stock only
          </label>
        )}
        {report === 'sell' && (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Status</label>
            <select value={sellStatus} onChange={(e) => setSellStatus(e.target.value)} className="h-9 rounded-lg border border-border bg-input px-2 text-xs font-bold text-foreground">
              {['all', 'new', 'contacted', 'price_offered', 'accepted', 'pickup_scheduled', 'picked_up', 'received', 'testing', 'paid', 'completed', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-lg font-black text-primary">{s.value}</div>
          </div>
        ))}
      </div>

      {/* table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> Loading data...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No data with these filters — try changing the date range or filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface/50 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {cols.map((c) => <th key={c.h} className={`px-4 py-3 ${c.right ? 'text-right' : ''}`}>{c.h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, i) => (
                    <tr key={i} className="border-b border-border/60 hover:bg-primary/5">
                      {row.map((cell, j) => (
                        <td key={j} className={`px-4 py-2.5 ${cols[j]?.right ? 'text-right font-bold' : ''} ${String(cell).includes('LOW STOCK') || String(cell).includes('OUT') ? 'font-bold text-destructive' : ''} ${typeof cell === 'number' && cols[j]?.h.includes('Revenue') || typeof cell === 'number' && (cols[j]?.h === 'Total' || cols[j]?.h === 'Spend' || cols[j]?.h === 'Balance' || cols[j]?.h.includes('Value')) ? 'text-primary' : ''}`}>
                          {typeof cell === 'number' && (cols[j]?.h.includes('₹') || ['Total', 'Revenue', 'Spend', 'Advance', 'Balance', 'Expected', 'Offered', 'Price', 'Sale Price', 'Stock Value'].includes(cols[j]?.h || '') || cols[j]?.h.includes('Revenue')) ? formatINR(cell) : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={rows.length} page={page} perPage={perPage} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} />
          </>
        )}
      </div>
    </div>
  );
}
