import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Phone, Mail, MapPin, Package, Truck, CreditCard, Send, RotateCcw, Camera, Video, ClipboardList, FileText, X as XIcon, ChevronLeft as PrevIcon, ChevronRight as NextIcon } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', price_offered: 'Price Offered',
  accepted: 'Accepted', rejected: 'Rejected', pickup_scheduled: 'Pickup Scheduled',
  picked_up: 'Picked Up', in_transit: 'In Transit', received: 'Received',
  testing: 'Testing', payment_pending: 'Payment Pending', paid: 'Paid',
  completed: 'Completed', cancelled: 'Cancelled',
};

const CONDITION_LABELS: Record<string, string> = {
  perfectly_working: 'Perfectly Working',
  minor_issue: 'Minor Issue',
  needs_repair: 'Needs Repair',
  dead: 'Dead / Not Working',
};

const NEXT_STATUS: Record<string, string[]> = {
  new: ['contacted', 'price_offered', 'cancelled'],
  contacted: ['price_offered', 'cancelled'],
  price_offered: ['accepted', 'rejected', 'cancelled'],
  accepted: ['pickup_scheduled', 'cancelled'],
  rejected: ['cancelled'],
  pickup_scheduled: ['picked_up', 'cancelled'],
  picked_up: ['in_transit'],
  in_transit: ['received'],
  received: ['testing'],
  testing: ['payment_pending', 'completed'],
  payment_pending: ['paid'],
  paid: ['completed'],
  completed: [],
  cancelled: [],
};

type Lead = {
  _id: string;
  customerName: string; customerMobile: string; customerEmail: string;
  customerAddress: string; customerCity: string; customerState: string; customerPincode: string;
  gstNumber: string;
  products: {
    category: string; brand: string; model: string; serialNumber: string;
    purchaseDate: string; warrantyRemaining: boolean; warrantyMonths: number;
    condition: string; accessories: string[]; expectedPrice: number;
    description: string; checklist?: Record<string, boolean>;
  }[];
  status: string; offeredPrice: number; declaredValue: number;
  adminNotes: { text: string; createdAt: string; _id: string }[];
  statusHistory: { status: string; timestamp: string; note: string }[];
  photos: { url: string; type: string }[]; videos: { url: string }[];
  awbNumber: string; courierName: string; trackingUrl: string;
  shiprocketOrderId: string; shiprocketShipmentId: string;
  pickupAddress: string; preferredPickupDate: string; preferredTimeSlot: string;
  createdAt: string; updatedAt: string;
};

export default function SellLeadDetail() {
  const { leadId } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerPrice, setOfferPrice] = useState('');
  const [note, setNote] = useState('');
  const [packWeight, setPackWeight] = useState('1');
  const [packL, setPackL] = useState('30');
  const [packB, setPackB] = useState('30');
  const [packH, setPackH] = useState('30');
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg] = useState('');
  const [lightbox, setLightbox] = useState<{ type: 'image' | 'video'; url: string; index: number } | null>(null);

  const allMedia = [
    ...(lead?.photos || []).map((p, i) => ({ type: 'image' as const, url: getImageUrl(p.url), index: i, label: p.type })),
    ...(lead?.videos || []).map((v, i) => ({ type: 'video' as const, url: getImageUrl(v.url), index: i, label: `Video ${i + 1}` })),
  ];

  const openLightbox = (type: 'image' | 'video', url: string, index: number) => setLightbox({ type, url, index });
  const closeLightbox = () => setLightbox(null);

  const lightboxNav = (dir: 1 | -1) => {
    if (!lightbox) return;
    const sameType = allMedia.filter((m) => m.type === lightbox.type);
    const current = sameType.findIndex((m) => m.url === lightbox.url);
    const next = ((current + dir) % sameType.length + sameType.length) % sameType.length;
    setLightbox({ ...lightbox, url: sameType[next].url, index: sameType[next].index });
  };

  const fetchLead = async () => {
    try {
      const res = await api.get(`/admin/sell/leads/${leadId}`);
      setLead(res.data);
      setOfferPrice(res.data.offeredPrice ? String(res.data.offeredPrice) : '');
      setPackWeight(String(res.data.packageWeight || 1));
      setPackL(String(res.data.packageLength || 30));
      setPackB(String(res.data.packageBreadth || 30));
      setPackH(String(res.data.packageHeight || 30));
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchLead(); }, [leadId]);

  const updateStatus = async (status: string) => {
    setActionLoading(status);
    setMsg('');
    try {
      await api.patch(`/admin/sell/leads/${leadId}/status`, { status, note: note || undefined });
      setMsg(`Status updated to ${STATUS_LABELS[status]}`);
      setNote('');
      fetchLead();
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading('');
    }
  };

  const handleOfferPrice = async () => {
    setActionLoading('offer');
    setMsg('');
    try {
      await api.post(`/admin/sell/leads/${leadId}/offer-price`, { offeredPrice: Number(offerPrice), note: note || undefined });
      setMsg('Price offered and notification sent');
      setNote('');
      fetchLead();
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Failed to offer price');
    } finally {
      setActionLoading('');
    }
  };

  const handleSchedulePickup = async () => {
    setActionLoading('pickup');
    setMsg('');
    try {
      await api.post(`/admin/sell/leads/${leadId}/schedule-pickup`, {
        packageWeight: Number(packWeight),
        packageLength: Number(packL),
        packageBreadth: Number(packB),
        packageHeight: Number(packH),
      });
      setMsg('Pickup scheduled');
      fetchLead();
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Failed to schedule pickup');
    } finally {
      setActionLoading('');
    }
  };

  const handleAddNote = async () => {
    if (!note) return;
    setActionLoading('note');
    try {
      await api.post(`/admin/sell/leads/${leadId}/notes`, { note });
      setMsg('Note added');
      setNote('');
      fetchLead();
    } catch { } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!lead) return <div className="text-center py-12 text-muted-foreground">Lead not found.</div>;

  return (
    <div>
      <Link to="/admin/sell" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4" /> Back to Leads
      </Link>

      {msg && (
        <div className={`rounded-xl border p-3 mb-4 text-sm font-bold ${
          msg.includes('Failed') ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'
        }`}>{msg}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Products */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Products ({lead.products?.length || 0})</h2>
            {lead.products?.map((prod: any, idx: number) => (
              <div key={idx} className="mb-4 last:mb-0 p-4 rounded-lg bg-surface/50 border border-border">
                <h3 className="font-bold text-sm text-primary mb-2">Product #{idx + 1}: {prod.brand} {prod.model}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Category:</span> <span className="font-medium">{prod.category}</span></p>
                    <p><span className="text-muted-foreground">Brand:</span> <span className="font-medium">{prod.brand}</span></p>
                    <p><span className="text-muted-foreground">Model:</span> <span className="font-medium">{prod.model}</span></p>
                    {prod.serialNumber && <p><span className="text-muted-foreground">Serial:</span> <code className="text-xs">{prod.serialNumber}</code></p>}
                    <p><span className="text-muted-foreground">Condition:</span> <span className="font-medium">{CONDITION_LABELS[prod.condition] || prod.condition}</span></p>
                    <p><span className="text-muted-foreground">Warranty:</span> {prod.warrantyRemaining ? `${prod.warrantyMonths} months` : 'No'}</p>
                    <p><span className="text-muted-foreground">Mining Used:</span> {prod.checklist?.miningUsed ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p><span className="text-muted-foreground">Expected Price:</span> <span className="font-bold text-primary">₹{(prod.expectedPrice || 0).toLocaleString('en-IN')}</span></p>
                    {prod.accessories?.length > 0 && (
                      <div className="mt-2"><span className="text-muted-foreground text-xs">Accessories:</span>
                        <div className="flex flex-wrap gap-1 mt-1">{prod.accessories.map((a: string) => <span key={a} className="text-xs bg-surface border border-border rounded-full px-2 py-0.5">{a}</span>)}</div>
                      </div>
                    )}
                    {prod.description && <div className="mt-2"><span className="text-muted-foreground text-xs">Description:</span><p className="text-sm bg-surface p-2 rounded-lg mt-1">{prod.description}</p></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Photos */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Photos ({(lead.photos || []).length})</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {(lead.photos || []).map((p, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border aspect-square cursor-pointer hover:opacity-80 transition" onClick={() => openLightbox('image', getImageUrl(p.url), i)}>
                  <img src={getImageUrl(p.url)} alt={p.type} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5">{p.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Videos */}
          {(lead.videos || []).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><Video className="h-5 w-5 text-primary" /> Videos ({(lead.videos || []).length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(lead.videos || []).map((v, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-80 transition" onClick={() => openLightbox('video', getImageUrl(v.url), i)}>
                    <video src={getImageUrl(v.url)} className="w-full h-48 object-cover pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          {lead.products?.filter((p: any) => p.checklist).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Checklists</h2>
              {lead.products?.map((prod: any, idx: number) => (
                prod.checklist ? (
                  <div key={idx} className="mb-3 last:mb-0">
                    <h4 className="text-xs font-bold text-primary mb-2">Product #{idx + 1}: {prod.brand} {prod.model}</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[{ key: 'powersOn', label: 'Powers On' }, { key: 'noPhysicalDamage', label: 'No Physical Damage' }, { key: 'noLiquidDamage', label: 'No Liquid Damage' }, { key: 'noBurningSmell', label: 'No Burning Smell' }, { key: 'allPortsWorking', label: 'All Ports Working' }, { key: 'displayOutputWorking', label: 'Display Output' }, { key: 'fansWorking', label: 'Fans Working' }, { key: 'neverRepaired', label: 'Never Repaired' }, { key: 'miningUsed', label: 'Mining Used' }].map((item) => (
                        <div key={item.key} className="flex items-center gap-2 text-sm">
                          <span className={`h-4 w-4 rounded flex items-center justify-center text-[10px] font-bold ${prod.checklist?.[item.key] ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{prod.checklist?.[item.key] ? 'Y' : 'N'}</span>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          )}

          {/* Status History */}
          {(lead.statusHistory || []).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" /> Status History</h2>
              <div className="space-y-2">
                {(lead.statusHistory || []).map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="shrink-0 w-24 text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleString('en-IN')}</span>
                    <span className="font-medium">{STATUS_LABELS[h.status] || h.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer Info */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold mb-3">Customer</h3>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {lead.customerName}</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.customerMobile}</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {lead.customerEmail}</p>
              <p className="text-xs text-muted-foreground ml-6">{lead.customerAddress}, {lead.customerCity}, {lead.customerState} - {lead.customerPincode}</p>
              {lead.gstNumber && <p className="text-xs text-muted-foreground">GST: {lead.gstNumber}</p>}
              {lead.pickupAddress && lead.pickupAddress !== lead.customerAddress && (
                <p className="text-xs text-muted-foreground"><b>Pickup:</b> {lead.pickupAddress}</p>
              )}
              {lead.preferredPickupDate && <p className="text-xs text-muted-foreground">Preferred: {new Date(lead.preferredPickupDate).toLocaleDateString('en-IN')} ({lead.preferredTimeSlot})</p>}
              <p className="text-xs text-muted-foreground">Lead ref: {lead._id}</p>
              <p className="text-xs text-muted-foreground">Created: {new Date(lead.createdAt).toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Tracking */}
          {lead.awbNumber && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Tracking</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">AWB:</span> <b className="font-mono text-primary">{lead.awbNumber}</b></p>
                {lead.courierName && <p><span className="text-muted-foreground">Courier:</span> {lead.courierName}</p>}
                {lead.trackingUrl && <a href={lead.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Track Live →</a>}
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold mb-3">Actions</h3>

            {/* Offer Price */}
            {(lead.status === 'new' || lead.status === 'contacted') && (
              <div className="mb-4 p-3 rounded-lg bg-surface/50 border border-border">
                <p className="text-xs font-bold mb-2">Offer Price</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm" placeholder="Amount" />
                  </div>
                  <button onClick={handleOfferPrice} disabled={actionLoading === 'offer' || !offerPrice} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Status Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(NEXT_STATUS[lead.status] || []).map((st) => (
                <button
                  key={st}
                  onClick={() => updateStatus(st)}
                  disabled={actionLoading === st}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                    st === 'cancelled' ? 'border border-destructive/50 text-destructive hover:bg-destructive/10' :
                    st === 'completed' ? 'bg-green-600 text-white hover:bg-green-500' :
                    st === 'paid' ? 'bg-green-600 text-white hover:bg-green-500' :
                    'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
                  }`}
                >
                  {actionLoading === st ? '...' : STATUS_LABELS[st] || st}
                </button>
              ))}
            </div>

            {/* Schedule Pickup */}
            {lead.status === 'accepted' && (
              <div className="mb-3 p-3 rounded-lg bg-surface/50 border border-border">
                <p className="text-xs font-bold mb-2 flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Schedule Pickup</p>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <input type="number" value={packWeight} onChange={(e) => setPackWeight(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Wt (kg)" />
                  <input type="number" value={packL} onChange={(e) => setPackL(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="L (cm)" />
                  <input type="number" value={packB} onChange={(e) => setPackB(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="B (cm)" />
                  <input type="number" value={packH} onChange={(e) => setPackH(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="H (cm)" />
                </div>
                <button onClick={handleSchedulePickup} disabled={actionLoading === 'pickup'} className="w-full rounded-lg bg-purple-600 text-white py-1.5 text-xs font-bold hover:bg-purple-500 disabled:opacity-40">
                  {actionLoading === 'pickup' ? 'Scheduling...' : 'Create Pickup (Shiprocket)'}
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Notes</h3>
            <div className="flex gap-2 mb-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm resize-none" placeholder="Add internal note..." />
              <button onClick={handleAddNote} disabled={actionLoading === 'note' || !note} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...(lead.adminNotes || [])].reverse().slice(0, 20).map((n) => (
                <div key={n._id} className="rounded-lg bg-surface/50 p-2 text-xs">
                  <p className="text-muted-foreground mb-0.5">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                  <p>{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition">
            <XIcon className="h-6 w-6" />
          </button>

          {allMedia.filter((m) => m.type === lightbox.type).length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); lightboxNav(-1); }}
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition">
              <PrevIcon className="h-6 w-6" />
            </button>
          )}

          <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'image' ? (
              <img src={lightbox.url} alt="" className="max-w-[90vw] max-h-[85vh] rounded-lg object-contain" />
            ) : (
              <video src={lightbox.url} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-lg" />
            )}
          </div>

          {allMedia.filter((m) => m.type === lightbox.type).length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); lightboxNav(1); }}
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition">
              <NextIcon className="h-6 w-6" />
            </button>
          )}

          <div className="absolute bottom-4 text-white/60 text-sm">
            {lightbox.type === 'image' ? lead?.photos?.[lightbox.index]?.type : `Video ${lightbox.index + 1}`} · {lightbox.index + 1} / {allMedia.filter((m) => m.type === lightbox.type).length}
          </div>
        </div>
      )}
    </div>
  );
}
