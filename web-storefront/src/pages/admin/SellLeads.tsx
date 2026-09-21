import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ChevronDown, ChevronRight, Search } from 'lucide-react';
import api from '@/lib/api';
import { formatINR } from '@/lib/cart';
import Pagination, { paginate, sortNewestFirst } from './Pagination';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'price_offered', label: 'Price Offered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received', label: 'Received' },
  { value: 'testing', label: 'Testing' },
  { value: 'payment_pending', label: 'Payment Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  contacted: 'bg-blue-500/15 text-blue-400',
  price_offered: 'bg-yellow-500/15 text-yellow-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  pickup_scheduled: 'bg-purple-500/15 text-purple-400',
  picked_up: 'bg-purple-500/15 text-purple-400',
  in_transit: 'bg-purple-500/15 text-purple-400',
  received: 'bg-green-500/15 text-green-400',
  testing: 'bg-yellow-500/15 text-yellow-400',
  payment_pending: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-green-500/15 text-green-400',
  completed: 'bg-green-500/15 text-green-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

const CONDITION_LABELS: Record<string, string> = {
  perfectly_working: 'Perfectly Working',
  minor_issue: 'Minor Issue',
  needs_repair: 'Needs Repair',
  dead: 'Dead / Not Working',
};

type LeadProduct = {
  category: string; brand: string; model: string; condition: string;
  expectedPrice: number; serialNumber?: string;
};

type Lead = {
  _id: string;
  customerName: string; customerMobile: string; customerEmail: string;
  customerCity: string; customerState: string;
  products?: LeadProduct[];
  status: string; offeredPrice: number;
  awbNumber: string; courierName: string;
  createdAt: string;
};

const FILTERS = ['all', 'new', 'price_offered', 'accepted', 'pickup_scheduled', 'received', 'paid', 'completed'] as const;

export default function SellLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    api.get('/admin/sell/leads')
      .then((r) => setLeads(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const searchQ = search.trim().toLowerCase();
  const filteredAll = sortNewestFirst(leads
    .filter((l) => filter === 'all' || l.status === filter)
    .filter((l) => {
      if (!searchQ) return true;
      const products = (l.products || []).map((p) => `${p.brand} ${p.model} ${p.category}`.toLowerCase()).join(' ');
      const hay = `${l.customerName} ${l.customerMobile} ${l.customerEmail} ${l.customerCity} ${l.customerState} ${products}`.toLowerCase();
      return hay.includes(searchQ);
    }));
  const filtered = paginate(filteredAll, page, perPage);
  useEffect(() => { setPage(1); }, [filter, search]);
  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const updateStatus = async (leadId: string, status: string) => {
    setUpdating(leadId);
    try {
      await api.patch(`/admin/sell/leads/${leadId}/status`, { status });
      setLeads((prev) => prev.map((l) => l._id === leadId ? { ...l, status } : l));
    } catch { }
    setUpdating(null);
  };

  const totalExpected = (l: Lead) => (l.products || []).reduce((s, p) => s + (p.expectedPrice || 0), 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-black mb-4">Sell Leads</h1>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : leads.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No leads yet</div>
      ) : (
        <>
          <div className="mb-4 flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${filter === f ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:border-primary'}`}>
                {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
              </button>
            ))}
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / phone / product..."
                className="h-10 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No leads match the filters</div>
          ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 px-3 py-3"></th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Expected</th>
                  <th className="px-5 py-3">Offer</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Tracking</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const isExpanded = expanded[lead._id] || false;
                  const products = lead.products || [];
                  return (
                    <Fragment key={lead._id}>
                      <tr className="border-b border-border hover:bg-surface/30">
                        <td className="px-3 py-3">
                          {products.length > 1 && (
                            <button onClick={() => toggleExpand(lead._id)} className="flex items-center justify-center h-6 w-6 rounded hover:bg-accent/20 text-muted-foreground">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-semibold">{lead.customerName}</div>
                          <div className="text-xs text-muted-foreground">{lead.customerMobile}</div>
                          <div className="text-xs text-muted-foreground">{lead.customerCity}, {lead.customerState}</div>
                        </td>
                        <td className="px-5 py-3">
                          <div>
                            <span>{products[0]?.brand} {products[0]?.model}</span>
                            {products.length > 1 && <span className="text-xs text-primary ml-1">+{products.length - 1}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{products[0]?.category}</div>
                        </td>
                        <td className="px-5 py-3 font-bold text-primary">{formatINR(totalExpected(lead))}</td>
                        <td className="px-5 py-3">
                          {lead.offeredPrice > 0 ? (
                            <span className="font-bold text-green-400">{formatINR(lead.offeredPrice)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <select value={lead.status} onChange={(e) => updateStatus(lead._id, e.target.value)} disabled={updating === lead._id}
                            className={`h-8 rounded-md border border-border bg-input px-2 text-xs font-semibold ${STATUS_COLORS[lead.status] || ''}`}>
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          {lead.awbNumber ? (
                            <div>
                              <code className="text-xs font-bold text-primary">{lead.awbNumber}</code>
                              <div className="text-xs text-muted-foreground">{lead.courierName}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN') : ''}
                        </td>
                        <td className="px-5 py-3">
                          <Link to={`/admin/sell/leads/${lead._id}`} className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                      {isExpanded && products.length > 1 && (
                        <tr key={`${lead._id}-expanded`} className="border-b border-border bg-surface/20">
                          <td colSpan={9} className="px-5 py-3">
                            <div className="space-y-1.5">
                              {products.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span>
                                    <span className="font-semibold">{p.brand} {p.model}</span>
                                    <span className="text-muted-foreground ml-2">{p.category}</span>
                                    <span className="text-muted-foreground ml-1">· {CONDITION_LABELS[p.condition] || p.condition}</span>
                                  </span>
                                  <span className="font-bold text-primary">{formatINR(p.expectedPrice || 0)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          <Pagination
            total={filteredAll.length}
            page={page}
            perPage={perPage}
            onPage={setPage}
            onPerPage={(n) => { setPerPage(n); setPage(1); }}
          />
        </>
      )}
    </div>
  );
}
