import { useEffect, useMemo, useState } from 'react';
import { adminApi, sellApi } from '@/lib/api';
import { formatINR } from '@/lib/cart';
import { formatOrderNo } from '@/lib/utils';
import { FileSpreadsheet, FileText, Loader2, RefreshCw, Calendar, BarChart3, Package, IndianRupee, Users, Boxes, Coins, Trophy, Search, AlertTriangle, PauseCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import Pagination, { paginate } from './Pagination';

type AnyRec = Record<string, unknown>;
type Row = (string | number)[];
type Col = { h: string; w: number; right?: boolean };

const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monthStartIST = () => `${todayIST().slice(0, 7)}-01`;
const d = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('en-IN') : '');
const ageDays = (v: unknown) => (v ? Math.floor((Date.now() - new Date(String(v)).getTime()) / 86400000) : 0);

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

const MONEY_COLS = ['Total', 'Revenue', 'Spend', 'Advance', 'Balance', 'Expected', 'Offered', 'Price', 'Sale Price', 'Stock Value', 'Due'];

// ---------- page ----------

const REPORT_TABS = [
  { key: 'dues', label: 'Payment Dues — કોનું બાકી?', icon: AlertTriangle },
  { key: 'money', label: 'Money In vs Pending', icon: IndianRupee },
  { key: 'stuck', label: 'Stuck Orders', icon: PauseCircle },
  { key: 'sales', label: 'Sales Summary', icon: BarChart3 },
  { key: 'top', label: 'Top Products', icon: Trophy },
  { key: 'orders', label: 'Orders', icon: Package },
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

  const [report, setReport] = useState<ReportKey>('dues');
  const [from, setFrom] = useState(monthStartIST());
  const [to, setTo] = useState(todayIST());
  const [status, setStatus] = useState('all');
  const [payType, setPayType] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [unsoldOnly, setUnsoldOnly] = useState(false);
  const [sellStatus, setSellStatus] = useState('all');
  const [groupBy, setGroupBy] = useState<'customer' | 'order'>('customer');
  const [stuckDays, setStuckDays] = useState(7);
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
  useEffect(() => { setPage(1); }, [report, from, to, status, payType, search, onlyLow, unsoldOnly, sellStatus, groupBy, stuckDays]);

  const inRange = (o: AnyRec) => {
    const t = o.createdAt ? new Date(String(o.createdAt)).getTime() : 0;
    return t >= new Date(`${from}T00:00:00`).getTime() && t <= new Date(`${to}T23:59:59`).getTime();
  };
  const isCod = (o: AnyRec) => (o.paymentResult as AnyRec)?.status === 'cod_advance';
  const active = (o: AnyRec) => !['cancelled', 'returned'].includes(String(o.status));

  const unpaidCodOrders = useMemo(() => orders.filter((o) => isCod(o) && !o.balancePaid && active(o)), [orders]);
  const rangeOrders = useMemo(() => orders.filter((o) => inRange(o)
    && (status === 'all' || String(o.status) === status)
    && (payType === 'all' || (payType === 'cod') === isCod(o))), [orders, from, to, status, payType]);
  const rangeActive = useMemo(() => rangeOrders.filter(active), [rangeOrders]);

  // money received per order: prepaid = full total; COD = advance + balance if settled
  const moneyIn = (o: AnyRec) => {
    if (isCod(o)) return (Number(o.codAdvanceAmount) || 0) + (o.balancePaid ? (Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0) : 0);
    return Number(o.totalPrice) || 0;
  };
  const balanceOf = (o: AnyRec) => (Number(o.totalPrice) || 0) - (Number(o.codAdvanceAmount) || 0);

  const { stats, cols, rows, title } = useMemo(() => {
    // ---- 1. PAYMENT DUES: કોનું payment બાકી છે ----
    if (report === 'dues') {
      const totalDue = unpaidCodOrders.reduce((s, o) => s + balanceOf(o), 0);
      if (groupBy === 'customer') {
        const byCustomer = new Map<string, { name: string; phone: string; city: string; count: number; advance: number; due: number; oldest: number; last: string }>();
        for (const o of unpaidCodOrders) {
          const a = (o.shippingAddress as AnyRec) || {};
          const u = o.user as AnyRec | string | undefined;
          const key = String((u && typeof u === 'object' && u.email) ? u.email : '') || `${a.fullName || '-'}|${a.phoneNumber || ''}`;
          const e = byCustomer.get(key) || {
            name: String(a.fullName || '-'), phone: String(a.phoneNumber || '-'), city: String(a.city || '-'),
            count: 0, advance: 0, due: 0, oldest: 0, last: '',
          };
          e.count++; e.advance += Number(o.codAdvanceAmount) || 0; e.due += balanceOf(o);
          e.oldest = Math.max(e.oldest, ageDays(o.createdAt));
          e.last = d(o.createdAt);
          byCustomer.set(key, e);
        }
        const list = Array.from(byCustomer.values()).sort((a, b) => b.due - a.due);
        return {
          title: 'Payment Dues — Customer-wise',
          stats: [
            { label: 'Customers with dues', value: String(list.length) },
            { label: 'Total balance due', value: formatINR(totalDue) },
            { label: 'Advance received', value: formatINR(list.reduce((s, x) => s + x.advance, 0)) },
            { label: 'Oldest due', value: `${list.reduce((m, x) => Math.max(m, x.oldest), 0)} days` },
            { label: 'Biggest due', value: list[0] ? `${list[0].name.slice(0, 18)} · ${formatINR(list[0].due)}` : '-' },
          ],
          cols: [
            { h: '#', w: 35 }, { h: 'Customer', w: 150 }, { h: 'Phone', w: 100 }, { h: 'City', w: 90 },
            { h: 'Orders', w: 55, right: true }, { h: 'Advance Paid', w: 90, right: true }, { h: 'Balance Due', w: 95, right: true },
            { h: 'Oldest (days)', w: 70, right: true }, { h: 'Last Order', w: 85 },
          ] as Col[],
          rows: list.map((x, i) => [i + 1, x.name, x.phone, x.city, x.count, x.advance, x.due, x.oldest, x.last]),
        };
      }
      const list = [...unpaidCodOrders].sort((a, b) => balanceOf(b) - balanceOf(a));
      return {
        title: 'Payment Dues — Order-wise',
        stats: [
          { label: 'Orders with dues', value: String(list.length) },
          { label: 'Total balance due', value: formatINR(totalDue) },
          { label: 'Advance received', value: formatINR(list.reduce((s, o) => s + (Number(o.codAdvanceAmount) || 0), 0)) },
          { label: 'Oldest due', value: `${list.reduce((m, o) => Math.max(m, ageDays(o.createdAt)), 0)} days` },
        ],
        cols: [
          { h: 'Order No', w: 80 }, { h: 'Date', w: 85 }, { h: 'Customer', w: 150 }, { h: 'Phone', w: 100 },
          { h: 'Advance', w: 85, right: true }, { h: 'Balance Due', w: 90, right: true }, { h: 'Age', w: 55, right: true }, { h: 'Status', w: 85 },
        ] as Col[],
        rows: list.map((o) => {
          const a = (o.shippingAddress as AnyRec) || {};
          return [formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(), d(o.createdAt), String(a.fullName || '-'), String(a.phoneNumber || '-'), Number(o.codAdvanceAmount) || 0, balanceOf(o), `${ageDays(o.createdAt)}d`, String(o.status)];
        }),
      };
    }

    // ---- 2. MONEY IN vs PENDING (cash flow) ----
    if (report === 'money') {
      const byMonth = new Map<string, { prepaid: number; advance: number; settled: number; count: number }>();
      for (const o of rangeActive) {
        const month = String(o.createdAt || '').slice(0, 7);
        const e = byMonth.get(month) || { prepaid: 0, advance: 0, settled: 0, count: 0 };
        e.count++;
        if (isCod(o)) {
          e.advance += Number(o.codAdvanceAmount) || 0;
          if (o.balancePaid) e.settled += balanceOf(o);
        } else {
          e.prepaid += Number(o.totalPrice) || 0;
        }
        byMonth.set(month, e);
      }
      const moneyInRange = rangeActive.reduce((s, o) => s + moneyIn(o), 0);
      const lostValue = rangeOrders.filter((o) => !active(o)).reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
      const outstanding = unpaidCodOrders.reduce((s, o) => s + balanceOf(o), 0);
      const totalBiz = rangeActive.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
      const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      return {
        title: `Money In vs Pending (${from} → ${to})`,
        stats: [
          { label: 'Total business', value: formatINR(totalBiz) },
          { label: 'Money received', value: formatINR(moneyInRange) },
          { label: 'Still pending (all-time)', value: formatINR(outstanding) },
          { label: 'Collection rate', value: totalBiz ? `${Math.round((moneyInRange / totalBiz) * 100)}%` : '-' },
          { label: 'Cancelled value', value: formatINR(lostValue) },
        ],
        cols: [
          { h: 'Month', w: 90 }, { h: 'Orders', w: 60, right: true }, { h: 'Prepaid received', w: 110, right: true },
          { h: 'COD advances received', w: 120, right: true }, { h: 'COD balances settled', w: 115, right: true }, { h: 'Total money in', w: 105, right: true },
        ] as Col[],
        rows: months.map(([m, e]) => [m, e.count, e.prepaid, e.advance, e.settled, e.prepaid + e.advance + e.settled]),
      };
    }

    // ---- 3. STUCK ORDERS ----
    if (report === 'stuck') {
      const list = orders.filter((o) => ['pending', 'shipped'].includes(String(o.status)) && ageDays(o.createdAt) >= stuckDays)
        .sort((a, b) => ageDays(b.createdAt) - ageDays(a.createdAt));
      const value = list.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
      const pending = list.filter((o) => String(o.status) === 'pending').length;
      return {
        title: `Stuck Orders (pending/shipped > ${stuckDays} days)`,
        stats: [
          { label: 'Stuck orders', value: String(list.length) },
          { label: 'Value stuck', value: formatINR(value) },
          { label: 'Still pending', value: String(pending) },
          { label: 'Shipped not delivered', value: String(list.length - pending) },
          { label: 'Oldest', value: `${list.reduce((m, o) => Math.max(m, ageDays(o.createdAt)), 0)} days` },
        ],
        cols: [
          { h: 'Order No', w: 80 }, { h: 'Date', w: 85 }, { h: 'Customer', w: 150 }, { h: 'Phone', w: 100 },
          { h: 'Status', w: 85 }, { h: 'Type', w: 65 }, { h: 'Days stuck', w: 70, right: true }, { h: 'COD due?', w: 70 }, { h: 'Total', w: 90, right: true },
        ] as Col[],
        rows: list.map((o) => {
          const a = (o.shippingAddress as AnyRec) || {};
          return [
            formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(),
            d(o.createdAt), String(a.fullName || '-'), String(a.phoneNumber || '-'),
            String(o.status), isCod(o) ? 'COD' : 'Prepaid', ageDays(o.createdAt),
            isCod(o) && !o.balancePaid ? formatINR(balanceOf(o)) : '-',
            Number(o.totalPrice) || 0,
          ];
        }),
      };
    }

    // ---- 4. SALES SUMMARY ----
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
      const pending = unpaidCodOrders.reduce((s, o) => s + balanceOf(o), 0);
      return {
        title: `Sales Summary (${from} → ${to})`,
        stats: [
          { label: 'Orders', value: String(rangeActive.length) },
          { label: 'Revenue', value: formatINR(rev) },
          { label: 'Prepaid', value: String(rangeActive.length - codCount) },
          { label: 'COD', value: String(codCount) },
          { label: 'Avg Order', value: formatINR(rangeActive.length ? Math.round(rev / rangeActive.length) : 0) },
          { label: 'COD Balance Due', value: formatINR(pending) },
        ],
        cols: [{ h: 'Date', w: 110 }, { h: 'Orders', w: 70, right: true }, { h: 'Prepaid', w: 70, right: true }, { h: 'COD', w: 60, right: true }, { h: 'Revenue', w: 100, right: true }] as Col[],
        rows: [
          ...Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([day, e]) => [day, e.count, e.prepaid, e.cod, e.revenue]),
          ['TOTAL', rangeActive.length, rangeActive.length - codCount, codCount, rev],
        ],
      };
    }

    // ---- 5. TOP PRODUCTS ----
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
          { label: 'Products sold', value: String(list.length) },
          { label: 'Total units', value: String(list.reduce((s, [, e]) => s + e.qty, 0)) },
          { label: 'Product revenue', value: formatINR(list.reduce((s, [, e]) => s + e.revenue, 0)) },
          { label: 'Best seller', value: list[0] ? `${list[0][0].slice(0, 22)} (${list[0][1].qty})` : '-' },
        ],
        cols: [{ h: '#', w: 40 }, { h: 'Product', w: 260 }, { h: 'Units', w: 70, right: true }, { h: 'Orders', w: 70, right: true }, { h: 'Revenue', w: 100, right: true }] as Col[],
        rows: list.map(([name, e], i) => [i + 1, name, e.qty, e.orders, e.revenue]),
      };
    }

    // ---- 6. ORDERS ----
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
          { label: 'Active revenue', value: formatINR(rev) },
          { label: 'Cancelled/Returned', value: String(list.length - list.filter(active).length) },
        ],
        cols: [
          { h: 'Order No', w: 80 }, { h: 'Date', w: 90 }, { h: 'Customer', w: 150 }, { h: 'Phone', w: 100 },
          { h: 'City', w: 90 }, { h: 'Items', w: 50, right: true }, { h: 'Type', w: 65 }, { h: 'Status', w: 85 }, { h: 'Total', w: 90, right: true },
        ] as Col[],
        rows: list.map((o) => {
          const a = (o.shippingAddress as AnyRec) || {};
          return [
            formatOrderNo(o.orderNumber) || String(o._id).slice(-6).toUpperCase(), d(o.createdAt), String(a.fullName || '-'), String(a.phoneNumber || '-'),
            String(a.city || '-'), ((o.orderItems as AnyRec[]) || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
            isCod(o) ? 'COD' : 'Prepaid', String(o.status), Number(o.totalPrice) || 0,
          ];
        }),
      };
    }

    // ---- 7. CUSTOMERS ----
    if (report === 'customers') {
      const stats2 = new Map<string, { count: number; total: number; last: number; due: number }>();
      for (const o of orders) {
        if (!active(o)) continue;
        const u = o.user as AnyRec | string | undefined;
        const uid = String((u && typeof u === 'object' && u._id) ? u._id : u || '');
        if (!uid) continue;
        const e = stats2.get(uid) || { count: 0, total: 0, last: 0, due: 0 };
        e.count++; e.total += Number(o.totalPrice) || 0;
        e.last = Math.max(e.last, o.createdAt ? new Date(String(o.createdAt)).getTime() : 0);
        if (isCod(o) && !o.balancePaid) e.due += balanceOf(o);
        stats2.set(uid, e);
      }
      const q = search.toLowerCase();
      const list = customers
        .map((c) => { const s = stats2.get(String(c._id)) || { count: 0, total: 0, last: 0, due: 0 }; return { c, s }; })
        .filter(({ c, s }) => s.count > 0 && (!q || String(c.name || '').toLowerCase().includes(q) || String(c.email || '').toLowerCase().includes(q)))
        .sort((a, b) => b.s.total - a.s.total);
      return {
        title: 'Customers (with orders)',
        stats: [
          { label: 'Customers', value: String(list.length) },
          { label: 'Total spend', value: formatINR(list.reduce((s, x) => s + x.s.total, 0)) },
          { label: 'With dues', value: String(list.filter((x) => x.s.due > 0).length) },
          { label: 'Best customer', value: list[0] ? `${String(list[0].c.name || '-').slice(0, 20)} (${formatINR(list[0].s.total)})` : '-' },
        ],
        cols: [
          { h: '#', w: 40 }, { h: 'Name', w: 160 }, { h: 'Email', w: 200 }, { h: 'Joined', w: 85 },
          { h: 'Orders', w: 60, right: true }, { h: 'Spend', w: 90, right: true }, { h: 'Balance Due', w: 90, right: true }, { h: 'Last Order', w: 85 },
        ] as Col[],
        rows: list.map(({ c, s }, i) => [i + 1, String(c.name || '-'), String(c.email || '-'), d(c.createdAt), s.count, s.total, s.due || '-', s.last ? d(new Date(s.last)) : '-']),
      };
    }

    // ---- 8. STOCK (with sold units + unsold filter) ----
    if (report === 'stock') {
      const sold = new Map<string, number>();
      for (const o of rangeActive) {
        for (const it of (o.orderItems as AnyRec[]) || []) {
          const pid = String(it.product || '');
          sold.set(pid, (sold.get(pid) || 0) + (Number(it.quantity) || 0));
        }
      }
      const q = search.toLowerCase();
      const list = products
        .map((p) => ({ p, soldQty: sold.get(String(p._id)) || 0 }))
        .filter(({ p, soldQty }) =>
          (!onlyLow || Number(p.stock) <= 3) &&
          (!unsoldOnly || soldQty === 0) &&
          (!q || String(p.name || '').toLowerCase().includes(q) || String(p.category || '').toLowerCase().includes(q)))
        .sort((a, b) => Number(a.p.stock) - Number(b.p.stock));
      const value = list.reduce((s, { p }) => s + (Number(p.salePrice) || Number(p.price) || 0) * (Number(p.stock) || 0), 0);
      return {
        title: `Stock / Inventory (sold in ${from} → ${to})`,
        stats: [
          { label: 'Products', value: String(list.length) },
          { label: 'Stock value', value: formatINR(value) },
          { label: 'Low stock (≤3)', value: String(list.filter(({ p }) => Number(p.stock) <= 3).length) },
          { label: 'Out of stock', value: String(list.filter(({ p }) => Number(p.stock) <= 0).length) },
          { label: 'Never sold in range', value: String(list.filter((x) => x.soldQty === 0).length) },
        ],
        cols: [
          { h: 'Product', w: 230 }, { h: 'Category', w: 105 }, { h: 'Stock', w: 55, right: true }, { h: 'Sold (range)', w: 75, right: true },
          { h: 'Price', w: 75, right: true }, { h: 'Sale Price', w: 80, right: true }, { h: 'Stock Value', w: 90, right: true }, { h: 'Flag', w: 90 },
        ] as Col[],
        rows: list.map(({ p, soldQty }) => [
          String(p.name || '-'), String(p.category || '-'), Number(p.stock) || 0, soldQty,
          Number(p.price) || 0, Number(p.salePrice) || 0,
          (Number(p.salePrice) || Number(p.price) || 0) * (Number(p.stock) || 0),
          Number(p.stock) <= 0 ? 'OUT OF STOCK' : Number(p.stock) <= 3 ? 'LOW STOCK' : soldQty === 0 ? 'NOT SELLING' : '',
        ]),
      };
    }

    // ---- 9. SELL LEADS ----
    const list = leads
      .filter((l) => (sellStatus === 'all' || String(l.status) === sellStatus) && inRange(l))
      .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    const completedValue = list.filter((l) => ['paid', 'completed'].includes(String(l.status))).reduce((s, l) => s + (Number(l.offeredPrice) || 0), 0);
    return {
      title: 'Sell Leads',
      stats: [
        { label: 'Requests', value: String(list.length) },
        { label: 'Completed value', value: formatINR(completedValue) },
        { label: 'Awaiting offer', value: String(list.filter((l) => ['new', 'contacted'].includes(String(l.status))).length) },
      ],
      cols: [
        { h: 'Request', w: 75 }, { h: 'Date', w: 85 }, { h: 'Customer', w: 130 }, { h: 'Mobile', w: 95 },
        { h: 'Products', w: 240 }, { h: 'Expected', w: 85, right: true }, { h: 'Offered', w: 85, right: true }, { h: 'Status', w: 95 },
      ] as Col[],
      rows: list.map((l) => {
        const prods = (l.products as AnyRec[]) || [];
        return [
          `#${String(l._id).slice(-6).toUpperCase()}`, d(l.createdAt), String(l.customerName || '-'), String(l.customerMobile || '-'),
          prods.map((p) => `${p.brand} ${p.model}`).join('; '),
          prods.reduce((s, p) => s + (Number(p.expectedPrice) || 0), 0), Number(l.offeredPrice) || 0, String(l.status || '-'),
        ];
      }),
    };
  }, [report, rangeActive, rangeOrders, orders, customers, products, leads, from, to, search, onlyLow, unsoldOnly, sellStatus, groupBy, stuckDays, unpaidCodOrders]);

  const exportData = (kind: 'excel' | 'pdf') => {
    if (rows.length === 0) { alert('Nothing to download with these filters.'); return; }
    const fileBase = `${report}-report-${todayIST()}`;
    const subtitle = stats.map((s) => `${s.label}: ${s.value}`).join('  ·  ');
    if (kind === 'excel') downloadCsv(fileBase, cols.map((c) => c.h), rows);
    else downloadPdf(fileBase, title, subtitle, cols.map((c) => c.h), rows, cols.map((c) => c.w));
  };

  const paged = paginate(rows as unknown as Record<string, unknown>[], page, perPage) as unknown as Row[];
  const usesDateRange = ['sales', 'top', 'orders', 'stock', 'sell', 'money'].includes(report);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Real business answers — filter, view on screen, then download.</p>
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

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((t) => (
          <button key={t.key} onClick={() => setReport(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${report === t.key ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

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
        {report === 'dues' && (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">View by</label>
            <div className="flex gap-1.5">
              <button onClick={() => setGroupBy('customer')} className={`h-9 rounded-full px-3 text-[11px] font-bold ${groupBy === 'customer' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>Customer</button>
              <button onClick={() => setGroupBy('order')} className={`h-9 rounded-full px-3 text-[11px] font-bold ${groupBy === 'order' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>Order</button>
            </div>
          </div>
        )}
        {report === 'stuck' && (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Older than (days)</label>
            <input type="number" min={1} value={stuckDays} onChange={(e) => setStuckDays(Math.max(1, Number(e.target.value) || 7))} className="h-9 w-24 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground" />
          </div>
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
          <>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground">
              <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="h-4 w-4 accent-primary" /> Low stock only
            </label>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground">
              <input type="checkbox" checked={unsoldOnly} onChange={(e) => setUnsoldOnly(e.target.checked)} className="h-4 w-4 accent-primary" /> Not selling only
            </label>
          </>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-lg font-black text-primary">{s.value}</div>
          </div>
        ))}
      </div>

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
                      {row.map((cell, j) => {
                        const header = cols[j]?.h || '';
                        const isMoney = typeof cell === 'number' && (MONEY_COLS.some((m) => header.includes(m)) || header.includes('received') || header.includes('settled') || header.includes('money'));
                        const flag = String(cell).includes('LOW STOCK') || String(cell).includes('OUT') || String(cell) === 'NOT SELLING' || header === 'Balance Due' && cell !== '-';
                        return (
                          <td key={j} className={`px-4 py-2.5 ${cols[j]?.right ? 'text-right font-bold' : ''} ${flag ? 'font-bold text-destructive' : ''} ${isMoney && !flag ? 'text-primary' : ''}`}>
                            {isMoney ? formatINR(cell as number) : String(cell)}
                          </td>
                        );
                      })}
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
