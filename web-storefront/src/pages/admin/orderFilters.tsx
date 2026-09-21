import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export type OrderFilters = {
  quick: 'all' | 'today' | 'month' | 'year';
  from: string;
  to: string;
  orderNo: string;
  userId: string;
  userQuery: string;
  productQuery: string;
  payment: 'all' | 'cod' | 'prepaid';
  status: 'all' | 'pending' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  missed: 'all' | 'yes' | 'no';
  year: string;
  month: string;
};

export const defaultFilters: OrderFilters = {
  quick: 'all',
  from: '',
  to: '',
  orderNo: '',
  userId: '',
  userQuery: '',
  productQuery: '',
  payment: 'all',
  status: 'all',
  missed: 'all',
  year: '',
  month: '',
};

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const STATUS_OPTIONS = ['pending', 'shipped', 'delivered', 'cancelled', 'returned'] as const;

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return localISO(new Date());
}

function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  return localISO(d);
}

function yearStartISO() {
  const d = new Date();
  d.setMonth(0, 1);
  return localISO(d);
}

export function isCodOrder(o: Record<string, unknown>) {
  return (o.paymentResult as Record<string, string>)?.status === 'cod_advance';
}

export function applyOrderFilters(orders: Record<string, unknown>[], f: OrderFilters): Record<string, unknown>[] {
  const fromMs = f.from ? new Date(f.from + 'T00:00:00').getTime() : null;
  const toMs = f.to ? new Date(f.to + 'T23:59:59.999').getTime() : null;
  const orderNo = f.orderNo.trim().toLowerCase();
  const userQ = f.userQuery.trim().toLowerCase();
  const prodQ = f.productQuery.trim().toLowerCase();

  return orders.filter((o) => {
    if (fromMs) {
      const t = new Date(String(o.createdAt)).getTime();
      if (t < fromMs) return false;
    }
    if (toMs) {
      const t = new Date(String(o.createdAt)).getTime();
      if (t > toMs) return false;
    }
    if (orderNo) {
      const num = String(o.orderNumber ?? '').padStart(4, '0').toLowerCase();
      const idFallback = String(o._id ?? '').slice(-8).toLowerCase();
      if (!num.includes(orderNo) && !idFallback.includes(orderNo)) return false;
    }
    if (f.userId) {
      const user = (o.user as Record<string, string>) || {};
      if (String(user._id || '') !== f.userId) return false;
    }
    if (userQ) {
      const user = (o.user as Record<string, string>) || {};
      const addr = (o.shippingAddress as Record<string, string>) || {};
      const hay = [String(user.name || ''), String(user.email || ''), String(addr.fullName || ''), String(addr.phoneNumber || '')].join(' ').toLowerCase();
      if (!hay.includes(userQ)) return false;
    }
    if (prodQ) {
      const items = (o.orderItems as Record<string, unknown>[]) || [];
      const hay = items.map((i) => String(i.name || '')).join(' ').toLowerCase();
      if (!hay.includes(prodQ)) return false;
    }
    if (f.payment !== 'all') {
      const isCod = isCodOrder(o);
      if (f.payment === 'cod' && !isCod) return false;
      if (f.payment === 'prepaid' && isCod) return false;
    }
    if (f.status !== 'all' && String(o.status) !== f.status) return false;
    if (f.missed === 'yes' && !o.isMissedOrder) return false;
    if (f.missed === 'no' && o.isMissedOrder) return false;
    return true;
  });
}

const inputCls = 'h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30';

function QuickButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${active ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:border-primary'}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SearchableDropdown({ options, value, onSelect, onClear, placeholder }: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
  onClear: () => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)} className={`${inputCls} flex items-center justify-between gap-2`}>
        <span className={`truncate ${selected ? '' : 'text-muted-foreground'}`}>{selected ? selected.label : placeholder}</span>
        {selected ? (
          <span onClick={(e) => { e.stopPropagation(); onClear(); }} className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></span>
        ) : (
          <span className="shrink-0 text-muted-foreground">▾</span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border bg-input px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search..." className="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</div>
            ) : (
              filtered.slice(0, 100).map((opt) => (
                <button key={opt.value} type="button" onClick={() => { onSelect(opt.value); setOpen(false); setQ(''); }} className={`block w-full px-3 py-2 text-left text-sm hover:bg-primary/5 ${opt.value === value ? 'font-bold text-primary' : 'text-foreground'}`}>
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

export function OrderFilterBar({ filters, setFilters, users, products }: {
  filters: OrderFilters;
  setFilters: (f: OrderFilters) => void;
  users: { value: string; label: string }[];
  products: { value: string; label: string }[];
}) {
  const [showMore, setShowMore] = useState(false);
  const set = (patch: Partial<OrderFilters>) => setFilters({ ...filters, ...patch });

  const quickClick = (q: OrderFilters['quick']) => {
    if (q === 'all') set({ quick: q, from: '', to: '', year: '', month: '' });
    if (q === 'today') set({ quick: q, from: todayISO(), to: todayISO() });
    if (q === 'month') set({ quick: q, from: monthStartISO(), to: todayISO() });
    if (q === 'year') set({ quick: q, from: yearStartISO(), to: todayISO() });
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const arr: string[] = [];
    for (let y = current; y >= current - 8; y--) arr.push(String(y));
    return arr;
  }, []);

  const setYearMonth = (year: string, month: string) => {
    if (year && month) {
      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
      set({ year, month, quick: 'all', from: `${year}-${month}-01`, to: `${year}-${month}-${String(daysInMonth).padStart(2, '0')}` });
    } else if (year) {
      set({ year, month: '', quick: 'all', from: `${year}-01-01`, to: `${year}-12-31` });
    } else {
      set({ year: '', month: '', quick: 'all', from: '', to: '' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <QuickButton active={filters.quick === 'all' && !filters.year && !filters.month} onClick={() => quickClick('all')}>All</QuickButton>
        <QuickButton active={filters.quick === 'today'} onClick={() => quickClick('today')}>Today</QuickButton>
        <QuickButton active={filters.quick === 'month' && !filters.year && !filters.month} onClick={() => quickClick('month')}>This Month</QuickButton>
        <QuickButton active={filters.quick === 'year' && !filters.year} onClick={() => quickClick('year')}>This Year</QuickButton>
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${showMore ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:border-primary'}`}
        >
          {showMore ? 'Hide Filters ▲' : 'More Filters ▼'}
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          {filters.year && filters.month ? `${MONTH_NAMES[Number(filters.month) - 1]} ${filters.year}` : filters.year ? `Year ${filters.year}` : ''}
          {filters.from ? `${filters.year || filters.month ? ' — ' : ''}From ${filters.from}` : ''}{filters.from && filters.to ? ' — ' : ''}{filters.to ? `To ${filters.to}` : ''}
          {(filters.orderNo || filters.userId || filters.productQuery || filters.payment !== 'all' || filters.status !== 'all' || filters.missed !== 'all' || filters.from) && (
            <button type="button" onClick={() => setFilters({ ...defaultFilters })} className="ml-2 rounded-full border border-border bg-card px-2.5 py-1 font-bold text-muted-foreground hover:border-destructive hover:text-destructive">
              Reset
            </button>
          )}
        </div>
      </div>
      {showMore && (
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="From Date">
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value, quick: 'all' })} className={inputCls} />
        </Field>
        <Field label="To Date">
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value, quick: 'all' })} className={inputCls} />
        </Field>
        <Field label="Year / Month">
          <div className="flex gap-2">
            <select value={filters.year} onChange={(e) => setYearMonth(e.target.value, filters.month)} className={inputCls}>
              <option value="">All Years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filters.month} onChange={(e) => setYearMonth(filters.year || String(new Date().getFullYear()), e.target.value)} className={inputCls}>
              <option value="">All Months</option>
              {MONTH_NAMES.map((m, i) => <option key={m} value={MONTHS[i]}>{m}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Order / Invoice No">
          <input type="text" value={filters.orderNo} onChange={(e) => set({ orderNo: e.target.value })} placeholder="e.g. 0007" className={inputCls} />
        </Field>
        <Field label="User">
          <SearchableDropdown options={users} value={filters.userId} onSelect={(v) => set({ userId: v })} onClear={() => set({ userId: '' })} placeholder="All users..." />
        </Field>
        <Field label="Product">
          <SearchableDropdown options={products} value={filters.productQuery} onSelect={(v) => set({ productQuery: v })} onClear={() => set({ productQuery: '' })} placeholder="All products..." />
        </Field>
        <Field label="Payment">
          <select value={filters.payment} onChange={(e) => set({ payment: e.target.value as OrderFilters['payment'] })} className={inputCls}>
            <option value="all">All</option>
            <option value="cod">COD</option>
            <option value="prepaid">Prepaid</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={filters.status} onChange={(e) => set({ status: e.target.value as OrderFilters['status'] })} className={inputCls}>
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </Field>
        <Field label="Missed">
          <select value={filters.missed} onChange={(e) => set({ missed: e.target.value as OrderFilters['missed'] })} className={inputCls}>
            <option value="all">All</option>
            <option value="yes">Missed Only</option>
            <option value="no">Normal Only</option>
          </select>
        </Field>
      </div>
      )}
    </div>
  );
}

function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadOrdersExcel(orders: Record<string, unknown>[]) {
  const header = [
    'Invoice No',
    'Order No',
    'Invoice Date',
    'Customer Name',
    'Phone',
    'Email',
    'Address',
    'City',
    'State',
    'Pincode',
    'Payment Type',
    'COD Status',
    'Order Status',
    'Item Name',
    'Qty',
    'Unit Price',
    'GST Rate %',
    'Taxable Value',
    'CGST',
    'SGST',
    'IGST',
    'Item Total',
    'Advance Amount',
    'Balance Amount',
    'Balance Paid / Settled Date',
    'Order Total',
  ];

  const rowForOrder = (o: Record<string, unknown>): (string | number)[][] => {
    const addr = (o.shippingAddress as Record<string, string>) || {};
    const user = (o.user as Record<string, string>) || {};
    const invoiceNo = formatInvoiceNo(o.orderNumber, String(o._id));
    const date = o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN') : '';
    const isCod = isCodOrder(o);
    const items = (o.orderItems as Record<string, unknown>[]) || [];
    const total = Number(o.totalPrice) || 0;
    const advanceAmt = isCod ? Number(o.codAdvanceAmount) || 0 : 0;
    const balanceAmt = isCod ? Math.max(0, total - advanceAmt) : 0;
    const settled = !!o.advancePaid && !!o.balancePaid;
    const codStatus = isCod
      ? settled ? 'All Settled' : o.advancePaid ? 'Balance Pending' : 'Advance Pending'
      : 'Paid';
    const settledDate = o.balancePaidAt
      ? new Date(String(o.balancePaidAt)).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : '';
    const customerName = addr.fullName || user.name || '';
    const phone = addr.phoneNumber || '';
    const base: (string | number)[] = [
      invoiceNo, invoiceNo, date, customerName, phone, String(user.email || ''), String(addr.streetAddress || ''),
      String(addr.city || ''), String(addr.state || ''), String(addr.zipCode || ''),
      isCod ? 'COD' : 'Prepaid', codStatus, String(o.status),
    ];

    if (items.length === 0) {
      return [[...base, '', 1, 0, 0, 0, 0, 0, 0, 0, advanceAmt, balanceAmt, settledDate, total]];
    }

    return items.map((it) => {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.price) || 0;
      const gstRate = Number(it.gstRate) || 18;
      const itemTotal = unit * qty;
      const taxable = Math.round(itemTotal / (1 + gstRate / 100));
      const gst = itemTotal - taxable;
      const cgst = Math.round(gst / 2);
      const sgst = gst - cgst;
      return [...base, String(it.name || ''), qty, unit, gstRate, taxable, cgst, sgst, 0, itemTotal, advanceAmt, balanceAmt, settledDate, total];
    });
  };

  const rows: string[] = [];
  const codOrders = orders.filter(isCodOrder);
  const prepaidOrders = orders.filter((o) => !isCodOrder(o));
  const groups = [
    { title: '=== COD ORDERS (ADVANCE PAYMENT) ===', list: codOrders },
    { title: '=== PREPAID ORDERS (FULL PAYMENT) ===', list: prepaidOrders },
  ];

  for (const g of groups) {
    if (g.list.length === 0) continue;
    rows.push(csvEscape(g.title));
    g.list.forEach((o) => rowForOrder(o).forEach((r) => rows.push(r.map((x) => csvEscape(x)).join(','))));
  }

  rows.push('');
  rows.push(csvEscape('=== SUMMARY ==='));
  const orderTotalSum = orders.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
  let taxableSum = 0;
  let cgstSum = 0;
  let sgstSum = 0;
  let itemCount = 0;
  orders.forEach((o) => {
    ((o.orderItems as Record<string, unknown>[]) || []).forEach((it) => {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.price) || 0;
      const gstRate = Number(it.gstRate) || 18;
      const itemTotal = unit * qty;
      const taxable = Math.round(itemTotal / (1 + gstRate / 100));
      const gst = itemTotal - taxable;
      const cgst = Math.round(gst / 2);
      taxableSum += taxable;
      cgstSum += cgst;
      sgstSum += gst - cgst;
      itemCount += qty;
    });
  });
  const summary: [string, string | number][] = [
    ['Total Orders', orders.length],
    ['COD Orders', codOrders.length],
    ['Prepaid Orders', prepaidOrders.length],
    ['Total Items (qty)', itemCount],
    ['Total Invoice Value (incl. GST)', orderTotalSum],
    ['Total Taxable Value', taxableSum],
    ['Total CGST', cgstSum],
    ['Total SGST', sgstSum],
    ['Total GST (CGST + SGST)', cgstSum + sgstSum],
  ];
  summary.forEach(([label, value]) => rows.push(`${csvEscape(label)},${csvEscape(value)}`));

  const csv = '\uFEFF' + header.map((h) => csvEscape(h)).join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invoices_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function formatInvoiceNo(orderNumber: unknown, id: string) {
  const s = String(orderNumber ?? '').trim();
  if (!s) return String(id).slice(-8).toUpperCase();
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? String(n).padStart(4, '0') : s;
}

export { STATUS_OPTIONS };
