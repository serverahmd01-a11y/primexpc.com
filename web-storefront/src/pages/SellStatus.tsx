import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/cart';
import { safeTrackingUrl, getImageUrl } from '@/lib/utils';
import { Package, Truck, Search, X, Camera, Video } from 'lucide-react';
import api from '@/lib/api';

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400', contacted: 'bg-blue-500/15 text-blue-400',
  price_offered: 'bg-yellow-500/15 text-yellow-400', accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400', pickup_scheduled: 'bg-purple-500/15 text-purple-400',
  picked_up: 'bg-purple-500/15 text-purple-400', in_transit: 'bg-purple-500/15 text-purple-400',
  received: 'bg-green-500/15 text-green-400', testing: 'bg-yellow-500/15 text-yellow-400',
  payment_pending: 'bg-yellow-500/15 text-yellow-400', paid: 'bg-green-500/15 text-green-400',
  completed: 'bg-green-500/15 text-green-400', cancelled: 'bg-red-500/15 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', price_offered: 'Price Offered',
  accepted: 'Accepted', rejected: 'Rejected', pickup_scheduled: 'Pickup Scheduled',
  picked_up: 'Picked Up', in_transit: 'In Transit', received: 'Received',
  testing: 'Testing', payment_pending: 'Payment Pending', paid: 'Paid',
  completed: 'Completed', cancelled: 'Cancelled',
};

const CONDITION_LABELS: Record<string, string> = {
  perfectly_working: 'Perfectly Working', minor_issue: 'Minor Issue',
  needs_repair: 'Needs Repair', dead: 'Dead / Not Working',
};

type Lead = {
  _id: string;
  products?: {
    category: string; brand: string; model: string; condition: string; expectedPrice: number;
    accessories?: string[]; description?: string;
    serialNumber?: string; purchaseDate?: string;
    warrantyRemaining?: number | string; warrantyMonths?: number | string;
    checklist?: Record<string, boolean | string>;
  }[];
  photos?: { url: string; type?: string }[];
  videos?: { url: string }[];
  customerName?: string; customerMobile?: string; customerEmail?: string;
  customerAddress?: string; customerCity?: string; customerState?: string; customerPincode?: string;
  gstNumber?: string; pickupAddress?: string; preferredPickupDate?: string; preferredTimeSlot?: string;
  status: string; offeredPrice: number;
  awbNumber: string; courierName: string; trackingUrl: string;
  createdAt: string;
};

export default function SellStatus() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [mobile, setMobile] = useState(searchParams.get('mobile') || '');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [apiError, setApiError] = useState('');
  const [actionError, setActionError] = useState('');
  const [lightbox, setLightbox] = useState<{ url: string; kind: 'photo' | 'video' } | null>(null);

  useEffect(() => { if (user) { setApiError(''); fetchMyLeads(); } }, [user]);

  const fetchMyLeads = async () => {
    setLoading(true);
    try {
      const r = await api.get('/sell/leads/me');
      console.log('/sell/leads/me response:', r.data);
      const data = Array.isArray(r.data) ? r.data : (r.data?.data || r.data?.leads || []);
      if (Array.isArray(data)) {
        setLeads(data);
      }
      setSearched(true);
      setApiError('');
    } catch (e: any) {
      console.error('/sell/leads/me ERROR:', e?.response?.status, e?.response?.data || e?.message);
      setLeads([]);
      setSearched(true);
      setApiError('Could not auto-load. Try searching by mobile number below.');
    } finally { setLoading(false); }
  };

  const fetchByMobile = async () => {
    if (!mobile || mobile.length < 10) return;
    setLoading(true);
    try {
      const r = await api.get(`/sell/leads?mobile=${mobile}`);
      console.log('/sell/leads?mobile response:', r.data);
      const data = Array.isArray(r.data) ? r.data : (r.data?.data || r.data?.leads || []);
      if (Array.isArray(data)) setLeads(data);
      setSearched(true);
    } catch (e: any) {
      console.error('/sell/leads?mobile ERROR:', e?.response?.status, e?.response?.data || e?.message);
    } finally { setLoading(false); }
  };
  const acceptOffer = async (id: string) => {
    setActionError('');
    try { await api.post(`/sell/leads/${id}/respond`, { action: 'accept', mobile: mobile || '' }); user ? fetchMyLeads() : fetchByMobile(); }
    catch (e: any) { setActionError(e?.response?.data?.message || 'Failed to accept offer. Try again.'); }
  };
  const rejectOffer = async (id: string) => {
    setActionError('');
    try { await api.post(`/sell/leads/${id}/respond`, { action: 'reject', mobile: mobile || '' }); user ? fetchMyLeads() : fetchByMobile(); }
    catch (e: any) { setActionError(e?.response?.data?.message || 'Failed to reject offer. Try again.'); }
  };
  const totalExpected = (l: Lead) => (l.products || []).reduce((s, p) => s + (p.expectedPrice || 0), 0);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-black">My Sell Requests</h1>
          {searched && leads.length > 0 && (
            <Link to="/sell/submit" className="text-[11px] font-bold text-primary hover:underline">+ New Sell Request</Link>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 max-w-md">
          <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)}
            placeholder="Enter your mobile number" onKeyDown={(e) => e.key === 'Enter' && fetchByMobile()}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] focus:border-primary outline-none" />
          <button onClick={fetchByMobile} disabled={loading}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
            <Search className="h-3.5 w-3.5" /> Search
          </button>
        </div>

        {apiError && <p className="mt-1 text-[11px] text-yellow-400">{apiError}</p>}
        {actionError && <p className="mt-1 text-[11px] text-destructive">{actionError}</p>}
        {user && searched && leads.length === 0 && !apiError && (
          <p className="mt-1 text-[11px] text-muted-foreground">No requests found linked to your login email. Try searching by mobile number above.</p>
        )}

        {!searched && !user ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Search className="h-7 w-7" /></div>
            <h2 className="mt-3 font-display text-base font-bold">Track your requests</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Enter your mobile number above to see your sell requests.</p>
          </div>
        ) : leads.length === 0 && searched ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Package className="h-7 w-7" /></div>
            <h2 className="mt-3 font-display text-base font-bold">No requests found</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">No sell requests found.</p>
            <Link to="/sell/submit" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">Sell Now</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const products = lead.products || [];
              return (
                <div key={lead._id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-surface/40">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sell Request</span>
                      <span className="ml-2 font-mono text-[13px] font-bold">#{lead._id.slice(-8).toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[lead.status] || 'bg-muted/15 text-muted-foreground'}`}>{STATUS_LABELS[lead.status] || lead.status}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2.5">
                      {products.map((item, i: number) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-surface to-background">
                            <Package className="h-4 w-4 text-primary/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-[13px] font-bold">{item.brand} {item.model}</div>
                            <div className="text-[11px] text-muted-foreground">{item.category} · {CONDITION_LABELS[item.condition] || item.condition}</div>
                          </div>
                          <div className="font-display font-bold text-[13px] text-primary">{formatINR(item.expectedPrice || 0)}</div>
                        </div>
                      ))}
                    </div>

                    {((lead.photos?.length || 0) + (lead.videos?.length || 0)) > 0 && (
                      <div className="mt-3">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your uploads — tap to view</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(lead.photos || []).filter((p) => p.url).map((p, i) => (
                            <button key={`p${i}`} type="button" onClick={() => setLightbox({ url: p.url, kind: 'photo' })} title={p.type || 'Photo'} className="group relative h-14 w-14 overflow-hidden rounded-md border border-border hover:border-primary transition">
                              <img src={getImageUrl(p.url)} alt={p.type || 'photo'} className="h-full w-full object-cover" loading="lazy" />
                              {p.type && <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-0.5 text-center text-[8px] font-bold uppercase text-white">{p.type}</span>}
                            </button>
                          ))}
                          {(lead.videos || []).filter((v) => v.url).map((v, i) => (
                            <button key={`v${i}`} type="button" onClick={() => setLightbox({ url: v.url, kind: 'video' })} title="Video" className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-border bg-surface hover:border-primary transition">
                              <Video className="h-5 w-5 text-primary" />
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-0.5 text-center text-[8px] font-bold uppercase text-white">Video</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="mt-3 rounded-md border border-border bg-surface/30">
                      <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">View full details</summary>
                      <div className="space-y-3 border-t border-border px-3 py-2.5 text-[12px]">
                        {products.map((item, i: number) => (
                          <div key={`d${i}`} className="rounded-md border border-border/60 p-2">
                            <div className="text-[12px] font-bold">{i + 1}. {item.brand} {item.model}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">{item.category} · {CONDITION_LABELS[item.condition] || item.condition} · Expected {formatINR(item.expectedPrice || 0)}</div>
                            {item.serialNumber && <div className="mt-1 text-[11px]"><span className="text-muted-foreground">Serial No:</span> <span className="font-mono">{item.serialNumber}</span></div>}
                            {(item.purchaseDate || item.warrantyMonths || item.warrantyRemaining) && (
                              <div className="mt-0.5 text-[11px]">
                                <span className="text-muted-foreground">Purchased:</span> {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '-'}
                                {item.warrantyMonths ? <> · <span className="text-muted-foreground">Warranty:</span> {item.warrantyMonths} mo</> : null}
                                {item.warrantyRemaining ? <> · <span className="text-muted-foreground">Left:</span> {item.warrantyRemaining}</> : null}
                              </div>
                            )}
                            {item.accessories && item.accessories.length > 0 && (
                              <div className="mt-1 text-[11px]"><span className="text-muted-foreground">Accessories:</span> {item.accessories.join(', ')}</div>
                            )}
                            {item.checklist && Object.keys(item.checklist).length > 0 && (
                              <div className="mt-1 text-[11px]"><span className="text-muted-foreground">Checklist:</span> {Object.entries(item.checklist).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${v}`).join(' · ')}</div>
                            )}
                            {item.description && <div className="mt-1 whitespace-pre-wrap text-[11px]"><span className="text-muted-foreground">Description:</span> {item.description}</div>}
                          </div>
                        ))}

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</div>
                            <div className="mt-0.5">{lead.customerName || '-'} · {lead.customerMobile || '-'}</div>
                            <div className="text-[11px] text-muted-foreground">{lead.customerEmail || '-'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Address</div>
                            <div className="mt-0.5 text-[11px]">{[lead.customerAddress, lead.customerCity, lead.customerState, lead.customerPincode].filter(Boolean).join(', ') || '-'}</div>
                            {lead.gstNumber ? <div className="text-[11px] text-muted-foreground">GSTIN: {lead.gstNumber}</div> : null}
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup Address</div>
                            <div className="mt-0.5 text-[11px]">{lead.pickupAddress || lead.customerAddress || '-'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preferred Pickup</div>
                            <div className="mt-0.5 text-[11px]">
                              {lead.preferredPickupDate ? new Date(lead.preferredPickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Any date'} · {lead.preferredTimeSlot ? lead.preferredTimeSlot.charAt(0).toUpperCase() + lead.preferredTimeSlot.slice(1) : 'Any time'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>

                    {lead.status === 'price_offered' && lead.offeredPrice > 0 && (
                      <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Our Offer</div>
                          <div className="font-display text-base font-black text-primary">{formatINR(lead.offeredPrice)}</div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => acceptOffer(lead._id)} className="rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-500 transition">Accept</button>
                          <button onClick={() => rejectOffer(lead._id)} className="rounded-md border border-destructive/50 px-3 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/10 transition">Reject</button>
                        </div>
                      </div>
                    )}

                    {lead.awbNumber && (
                      <div className="mt-3 rounded-md border border-border bg-surface/30 p-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-muted-foreground">Tracking AWB</div>
                          <div className="font-mono text-[13px] font-bold text-primary">{lead.awbNumber}</div>
                          <div className="text-[11px] text-muted-foreground">{lead.courierName}</div>
                        </div>
                        {lead.trackingUrl && (
                          <a href={safeTrackingUrl(lead.trackingUrl)} target="_blank" rel="noopener noreferrer" className="rounded-md bg-primary/10 border border-primary/30 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition flex items-center gap-1"><Truck className="h-3 w-3" /> Track</a>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                      <span className="text-[13px] text-muted-foreground">{products.length} item(s)</span>
                      <span className="font-display text-base font-black text-primary">
                        {lead.status === 'price_offered' || lead.status === 'accepted' || lead.status === 'paid' || lead.status === 'completed'
                          ? formatINR(lead.offeredPrice || 0)
                          : formatINR(totalExpected(lead))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-[92vw] max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
            {lightbox.kind === 'photo' ? (
              <img src={getImageUrl(lightbox.url)} alt="" className="max-w-[92vw] max-h-[85vh] rounded-lg object-contain" />
            ) : (
              <video src={getImageUrl(lightbox.url)} controls autoPlay className="max-w-[92vw] max-h-[85vh] rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
