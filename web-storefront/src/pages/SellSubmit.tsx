import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Upload, X, Check, Camera, Video, Trash2, Clock, MapPin, Plus, Minus } from 'lucide-react';
import api from '@/lib/api';

const CONDITIONS = [
  { value: 'perfectly_working', label: 'Perfectly Working' },
  { value: 'minor_issue', label: 'Minor Issue' },
  { value: 'needs_repair', label: 'Needs Repair' },
  { value: 'dead', label: 'Dead / Not Working' },
];

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

const PHOTO_TYPES = [
  { key: 'front', label: 'Front View *' },
  { key: 'back', label: 'Back View *' },
  { key: 'ports', label: 'Ports *' },
  { key: 'serial', label: 'Serial Sticker *' },
  { key: 'box', label: 'Original Box' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'other', label: 'Other' },
];

const STEP_LABELS = ['Products', 'Photos', 'Videos', 'Checklist', 'Your Details', 'Review & Submit'];

const SESSION_KEY = 'sell_form_state_v2';

type SavedPhoto = { type: string; thumbnail: string; needsReupload: boolean };
type SavedVideo = { thumbnail: string; needsReupload: boolean };

function loadSavedState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

function saveState(state: Record<string, unknown>) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch { }
}

function clearSavedState() { sessionStorage.removeItem(SESSION_KEY); }

function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file.slice(0, 1024 * 100));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 150;
      let w = img.width, h = img.height;
      if (w > h) { w = max; h = Math.round((max / img.width) * img.height); }
      else { h = max; w = Math.round((max / img.height) * img.width); }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
}

function StepIndicator({ current, setStep }: { current: number; setStep: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
      {STEP_LABELS.map((label, i) => (
        <button key={i} onClick={() => i < current && setStep(i)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
            i === current ? 'bg-primary text-primary-foreground' : i < current ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30' : 'bg-border/50 text-muted-foreground cursor-default'
          }`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
            i < current ? 'bg-primary text-primary-foreground' : i === current ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'
          }`}>{i < current ? <Check className="h-3 w-3" /> : i + 1}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function SellSubmit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const saved = loadSavedState();
  const [step, setStep] = useState(saved?.step ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [error, setError] = useState('');

  const makeProduct = () => ({
    category: '', brand: '', model: '', serialNumber: '',
    purchaseDate: '', warrantyRemaining: false, warrantyMonths: 0,
    condition: '', accessories: [] as string[],
    expectedPrice: '', description: '',
    checklist: { powersOn: false, noPhysicalDamage: false, noLiquidDamage: false, noBurningSmell: false, allPortsWorking: false, displayOutputWorking: false, fansWorking: false, neverRepaired: false, miningUsed: false },
  });

  const [products, setProducts] = useState<(ReturnType<typeof makeProduct>)[]>(
    saved?.products?.length ? saved.products : [makeProduct()]
  );
  const [activeProductIdx, setActiveProductIdx] = useState(0);
  const [activeChecklistIdx, setActiveChecklistIdx] = useState(0);

  const updateProduct = (idx: number, field: string, value: any) => {
    setProducts((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const addProduct = () => { setProducts((p) => [...p, makeProduct()]); setActiveProductIdx(products.length); };
  const removeProduct = (idx: number) => {
    if (products.length <= 1) return;
    setProducts((p) => p.filter((_, i) => i !== idx));
    if (activeProductIdx >= idx) setActiveProductIdx((p) => Math.max(0, p - 1));
  };

  const [photos, setPhotos] = useState<{ file?: File; type: string; preview: string; needsReupload?: boolean }[]>(
    (saved?.photos || []).map((p: SavedPhoto) => ({ type: p.type, preview: p.thumbnail || '', needsReupload: true }))
  );
  const [videos, setVideos] = useState<{ file?: File; preview: string; needsReupload?: boolean }[]>(
    (saved?.videos || []).map((v: SavedVideo) => ({ preview: v.thumbnail || '', needsReupload: true }))
  );

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const currentPhotoType = useRef('other');

  const [customerName, setCustomerName] = useState(saved?.customerName ?? '');
  const [customerMobile, setCustomerMobile] = useState(saved?.customerMobile ?? '');
  const [customerEmail, setCustomerEmail] = useState(saved?.customerEmail ?? '');
  const [customerAddress, setCustomerAddress] = useState(saved?.customerAddress ?? '');
  const [customerCity, setCustomerCity] = useState(saved?.customerCity ?? '');
  const [customerState, setCustomerState] = useState(saved?.customerState ?? '');
  const [customerPincode, setCustomerPincode] = useState(saved?.customerPincode ?? '');
  const [gstNumber, setGstNumber] = useState(saved?.gstNumber ?? '');
  const [pickupAddress, setPickupAddress] = useState(saved?.pickupAddress ?? '');
  const [preferredPickupDate, setPreferredPickupDate] = useState(saved?.preferredPickupDate ?? '');
  const [preferredTimeSlot, setPreferredTimeSlot] = useState(saved?.preferredTimeSlot ?? '');

  useEffect(() => {
    const photoData = photos.map((p) => ({ type: p.type, thumbnail: p.preview?.startsWith('data:') ? p.preview : '', needsReupload: false }));
    const videoData = videos.map((v) => ({ thumbnail: v.preview?.startsWith('data:') ? v.preview : '', needsReupload: false }));
    saveState({
      step, products, photos: photoData, videos: videoData,
      customerName, customerMobile, customerEmail, customerAddress,
      customerCity, customerState, customerPincode, gstNumber,
      pickupAddress, preferredPickupDate, preferredTimeSlot,
    });
  });

  const canNext = () => {
    switch (step) {
      case 0: return products.length > 0 && products.every((p) => p.category && p.brand && p.model && p.condition);
      case 1: return photos.filter((p) => ['front', 'back', 'ports', 'serial'].includes(p.type)).length >= 4 && photos.length >= 4;
      case 2: return videos.length >= 1;
      case 3: return products.every((p) => Object.values(p.checklist).some((v) => v));
      case 4: return customerName && customerMobile && customerEmail && customerAddress && customerCity && customerState && customerPincode;
      case 5: return true;
      default: return false;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files; if (!files) return;
    const newPhotos: { file: File; type: string; preview: string; needsReupload: boolean }[] = [];
    for (const file of Array.from(files)) {
      if (photos.length + newPhotos.length >= 20) break;
      const thumbnail = await createThumbnail(file);
      newPhotos.push({ file, type, preview: thumbnail || URL.createObjectURL(file), needsReupload: false });
    }
    setPhotos((p) => [...p, ...newPhotos]); setError(''); e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    if (photos[idx].preview?.startsWith('blob:')) URL.revokeObjectURL(photos[idx].preview);
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  const replacePhotoFile = (idx: number, file: File) => {
    createThumbnail(file).then((thumbnail) => {
      setPhotos((p) => { const u = [...p]; u[idx] = { ...u[idx], file, preview: thumbnail || URL.createObjectURL(file), needsReupload: false }; return u; });
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const newVideos: { file: File; preview: string; needsReupload: boolean }[] = [];
    for (const file of Array.from(files)) {
      if (videos.length + newVideos.length >= 5) break;
      const thumbnail = await createThumbnail(file);
      newVideos.push({ file, preview: thumbnail || URL.createObjectURL(file), needsReupload: false });
    }
    setVideos((v) => [...v, ...newVideos]); setError(''); e.target.value = '';
  };

  const removeVideo = (idx: number) => {
    if (videos[idx].preview?.startsWith('blob:')) URL.revokeObjectURL(videos[idx].preview);
    setVideos((v) => v.filter((_, i) => i !== idx));
  };

  const replaceVideoFile = (idx: number, file: File) => {
    createThumbnail(file).then((thumbnail) => {
      setVideos((v) => { const u = [...v]; u[idx] = { ...u[idx], file, preview: thumbnail || URL.createObjectURL(file), needsReupload: false }; return u; });
    });
  };

  const uploadFiles = async (files: { file?: File; preview: string }[], endpoint: string) => {
    const fd = new FormData(); files.forEach((f) => { if (f.file) fd.append('files', f.file); });
    if (!fd.has('files')) return [];
    const res = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.files || [];
  };

  const handleSubmit = async () => {
    const missingPhotos = photos.filter((p) => !p.file).length;
    const missingVideos = videos.filter((v) => !v.file).length;
    if (missingPhotos > 0 || missingVideos > 0) {
      setError(`Please re-upload ${missingPhotos > 0 ? `${missingPhotos} photo(s)` : ''}${missingPhotos && missingVideos ? ' and ' : ''}${missingVideos > 0 ? `${missingVideos} video(s)` : ''} before submitting. Go back to Step 2.`);
      return;
    }
    setSubmitting(true); setError('');
    try {
      let photoUrls: any[] = [], videoUrls: any[] = [], uploadErrors: string[] = [];
      try { const r = await uploadFiles(photos, '/sell/upload'); photoUrls = r; } catch (e: any) { uploadErrors.push('Photo upload failed: ' + (e.response?.data?.message || e.message)); }
      try { const r = await uploadFiles(videos, '/sell/upload'); videoUrls = r; } catch (e: any) { uploadErrors.push('Video upload failed: ' + (e.response?.data?.message || e.message)); }
      if (uploadErrors.length > 0) { setError(uploadErrors.join('. ')); setSubmitting(false); return; }

      const body = {
        customerName, customerMobile, customerEmail,
        customerAddress, customerCity, customerState, customerPincode, gstNumber,
        products: products.map((p) => ({
          category: p.category, brand: p.brand, model: p.model,
          serialNumber: p.serialNumber, purchaseDate: p.purchaseDate || null,
          warrantyRemaining: p.warrantyRemaining, warrantyMonths: p.warrantyMonths,
          condition: p.condition, accessories: p.accessories,
          expectedPrice: p.expectedPrice ? Number(p.expectedPrice) : 0,
          description: p.description, checklist: p.checklist,
        })),
        photos: photos.map((p, i) => ({ url: photoUrls[i]?.url || '', type: p.type })),
        videos: videos.map((_, i) => ({ url: videoUrls[i]?.url || '' })),
        pickupAddress: pickupAddress || customerAddress,
        preferredPickupDate: preferredPickupDate || null,
        preferredTimeSlot,
      };

      const res = await api.post('/sell/submit', body);
      setLeadId(res.data.leadId); setSubmitted(true); clearSavedState();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const toggleAccessory = (pIdx: number, item: string) => {
    updateProduct(pIdx, 'accessories', products[pIdx].accessories.includes(item)
      ? products[pIdx].accessories.filter((x) => x !== item)
      : [...products[pIdx].accessories, item]);
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary mb-6"><Check className="h-10 w-10" /></div>
        <h1 className="font-display text-3xl font-black text-foreground mb-4">Submission Successful!</h1>
        <p className="text-muted-foreground mb-2">Your lead has been submitted for review.</p>
        <p className="text-sm text-muted-foreground mb-6">Reference ID: <b className="text-primary font-mono">{leadId?.slice(-8).toUpperCase()}</b></p>
        <div className="bg-surface/60 border border-border rounded-xl p-6 mb-6 text-left">
          <h3 className="font-bold text-foreground mb-3">What happens next?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Our team reviews your submission (24-48 hours)</li>
            <li>You'll receive a price quote via email/SMS</li>
            <li>Accept the offer and we schedule free pickup</li>
            <li>After testing, payment is sent to you</li>
          </ol>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(`/sell/status?mobile=${customerMobile}`)} className="rounded-xl bg-primary/10 border border-primary px-6 py-2.5 text-sm font-bold text-primary hover:bg-primary/20">Track Status</button>
          <button onClick={() => navigate('/')} className="rounded-xl border border-border px-6 py-2.5 text-sm font-bold text-muted-foreground hover:bg-accent/20">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <StepIndicator current={step} setStep={setStep} />

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 mb-6 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        {/* Step 0: Products */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div><h2 className="font-display text-2xl font-black text-foreground">Product Information</h2><p className="text-sm text-muted-foreground">Add all the hardware you want to sell</p></div>
              <button onClick={addProduct} className="flex items-center gap-1.5 rounded-xl border border-primary bg-primary/10 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/20"><Plus className="h-4 w-4" /> Add Product</button>
            </div>

            {products.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {products.map((p, i) => (
                  <button key={i} onClick={() => setActiveProductIdx(i)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeProductIdx === i ? 'bg-primary text-primary-foreground' : 'bg-surface border border-border hover:border-primary/50'}`}>
                    {p.category || 'Product'} {i + 1}
                  </button>
                ))}
              </div>
            )}

            {products.map((p, pIdx) => (
              <div key={pIdx} className={`space-y-4 ${pIdx !== activeProductIdx ? 'hidden' : ''}`}>
                {pIdx !== activeProductIdx ? null : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-primary">Product #{pIdx + 1}</h3>
                      {products.length > 1 && <button onClick={() => removeProduct(pIdx)} className="text-xs text-destructive hover:underline flex items-center gap-1"><Trash2 className="h-3 w-3" /> Remove</button>}
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1.5">Category *</label>
                      <input type="text" value={p.category} onChange={(e) => updateProduct(pIdx, 'category', e.target.value)} placeholder="e.g. Graphics Card, Laptop, CPU" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:border-primary outline-none" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className="block text-sm font-bold mb-1.5">Brand *</label><input type="text" value={p.brand} onChange={(e) => updateProduct(pIdx, 'brand', e.target.value)} placeholder="e.g. ASUS, MSI" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:border-primary outline-none" /></div>
                      <div><label className="block text-sm font-bold mb-1.5">Model *</label><input type="text" value={p.model} onChange={(e) => updateProduct(pIdx, 'model', e.target.value)} placeholder="e.g. RTX 3080" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:border-primary outline-none" /></div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className="block text-sm font-bold mb-1.5">Serial Number</label><input type="text" value={p.serialNumber} onChange={(e) => updateProduct(pIdx, 'serialNumber', e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
                      <div><label className="block text-sm font-bold mb-1.5">Purchase Date</label><input type="date" value={p.purchaseDate} onChange={(e) => updateProduct(pIdx, 'purchaseDate', e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2">Warranty Left?</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={p.warrantyRemaining} onChange={() => updateProduct(pIdx, 'warrantyRemaining', true)} className="text-primary" /> Yes</label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={!p.warrantyRemaining} onChange={() => { updateProduct(pIdx, 'warrantyRemaining', false); updateProduct(pIdx, 'warrantyMonths', 0); }} className="text-primary" /> No</label>
                      </div>
                      {p.warrantyRemaining && <input type="number" value={p.warrantyMonths} onChange={(e) => updateProduct(pIdx, 'warrantyMonths', Number(e.target.value))} placeholder="Remaining months" className="mt-2 w-40 rounded-xl border border-border bg-surface px-4 py-2 text-sm" />}
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2">Working Condition *</label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {CONDITIONS.map((c) => (
                          <label key={c.value} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${p.condition === c.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                            <input type="radio" name={`condition-${pIdx}`} checked={p.condition === c.value} onChange={() => updateProduct(pIdx, 'condition', c.value)} className="text-primary" /><span className="text-sm font-medium">{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2">Accessories Included</label>
                      <div className="flex flex-wrap gap-2">
                        {['Original Box', 'Invoice', 'Power Adapter', 'Cables', 'Accessories'].map((a) => (
                          <button key={a} onClick={() => toggleAccessory(pIdx, a)} className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${p.accessories.includes(a) ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                            {p.accessories.includes(a) && <Check className="inline h-3 w-3 mr-1" />}{a}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1.5">Expected Price (Optional)</label>
                      <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span><input type="number" value={p.expectedPrice} onChange={(e) => updateProduct(pIdx, 'expectedPrice', e.target.value)} placeholder="Enter amount" className="w-full rounded-xl border border-border bg-surface pl-8 pr-4 py-2.5 text-sm" /></div>
                    </div>

                    <div><label className="block text-sm font-bold mb-1.5">Description</label><textarea value={p.description} onChange={(e) => updateProduct(pIdx, 'description', e.target.value)} placeholder="Describe your hardware, any issues, usage history..." rows={4} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm resize-none" /></div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Photos */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-display text-2xl font-black text-foreground">Upload Photos</h2>
            <p className="text-sm text-muted-foreground">Minimum 4 photos required (max 20). Must include Front, Back, Ports, and Serial Sticker.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {PHOTO_TYPES.map((pt) => (
                <div key={pt.key} className="rounded-xl border border-dashed border-border bg-surface/50 p-4">
                  <label className="block text-sm font-bold mb-2">{pt.label}</label>
                  <div className="flex flex-wrap gap-2">
                    {photos.filter((p) => p.type === pt.key).map((p, i) => {
                      const globalIdx = photos.findIndex((x) => x === p);
                      return (
                        <div key={i} className={`relative h-20 w-20 rounded-lg overflow-hidden border ${p.needsReupload ? 'border-destructive/60 border-2' : 'border-border'}`}>
                          {p.needsReupload ? (
                            <label className="flex h-full w-full cursor-pointer items-center justify-center bg-surface text-destructive hover:bg-destructive/10 transition">
                              <Upload className="h-5 w-5" /><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replacePhotoFile(globalIdx, f); }} />
                            </label>
                          ) : <img src={p.preview} alt="" className="h-full w-full object-cover" />}
                          <button onClick={() => removePhoto(globalIdx)} className="absolute top-0.5 right-0.5 rounded-full bg-destructive/80 p-0.5 text-white"><X className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    <button onClick={() => { currentPhotoType.current = pt.key; photoInputRef.current?.click(); }} className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border hover:border-primary transition"><Upload className="h-5 w-5 text-muted-foreground" /></button>
                  </div>
                </div>
              ))}
            </div>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" multiple onChange={(e) => handlePhotoUpload(e, currentPhotoType.current)} className="hidden" />
            <div className="text-sm text-muted-foreground"><Camera className="inline h-4 w-4 mr-1" />{photos.length} / 20 photos</div>
          </div>
        )}

        {/* Step 2: Videos */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-display text-2xl font-black text-foreground">Upload Video</h2>
            <p className="text-sm text-muted-foreground">Upload at least 1 video (max 5). Recommended: power-on, GPU working, BIOS boot, ports, fans.</p>
            <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center">
              <Video className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Click to upload</p>
              <button onClick={() => videoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/20"><Upload className="h-4 w-4" /> Upload Videos</button>
              <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={handleVideoUpload} className="hidden" />
            </div>
            {videos.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {videos.map((v, i) => (
                  <div key={i} className={`relative rounded-xl overflow-hidden border ${v.needsReupload ? 'border-destructive/60 border-2' : 'border-border'} bg-surface`}>
                    {v.needsReupload ? (
                      <label className="flex items-center justify-center h-40 w-full cursor-pointer bg-surface hover:bg-destructive/5 transition">
                        <div className="text-center"><Upload className="mx-auto h-8 w-8 text-destructive mb-1" /><p className="text-xs font-bold text-destructive">Re-upload</p><input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceVideoFile(i, f); }} /></div>
                      </label>
                    ) : <video src={v.preview} controls className="w-full h-40 object-cover" />}
                    <button onClick={() => removeVideo(i)} className="absolute top-2 right-2 rounded-full bg-destructive/80 p-1 text-white"><X className="h-4 w-4" /></button>
                    <div className="px-3 py-2 text-xs text-muted-foreground">Video {i + 1}{v.file ? ` (${(v.file.size / 1024 / 1024).toFixed(1)} MB)` : ' (needs re-upload)'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Checklists */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display text-2xl font-black text-foreground">Functional Checklist</h2>
            <p className="text-sm text-muted-foreground">Confirm condition for each product</p>

            {products.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {products.map((p, i) => (
                  <button key={i} onClick={() => setActiveChecklistIdx(i)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeChecklistIdx === i ? 'bg-primary text-primary-foreground' : 'bg-surface border border-border hover:border-primary/50'}`}>
                    {p.category || 'Product'} {i + 1}
                  </button>
                ))}
              </div>
            )}

            {products.map((p, pIdx) => (
              <div key={pIdx} className={`space-y-3 ${pIdx !== activeChecklistIdx ? 'hidden' : ''}`}>
                {pIdx !== activeChecklistIdx ? null : (
                  <>
                    <h3 className="font-bold text-sm text-primary">{p.category || `Product #${pIdx + 1}`}</h3>
                    {[{ key: 'powersOn' as const, label: 'Device powers on' }, { key: 'noPhysicalDamage' as const, label: 'No physical damage' }, { key: 'noLiquidDamage' as const, label: 'No liquid damage' }, { key: 'noBurningSmell' as const, label: 'No burning smell' }, { key: 'allPortsWorking' as const, label: 'All ports working' }, { key: 'displayOutputWorking' as const, label: 'Display output working' }, { key: 'fansWorking' as const, label: 'Fans working' }, { key: 'neverRepaired' as const, label: 'Never repaired' }].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:border-primary/50 transition">
                        <input type="checkbox" checked={!!p.checklist[item.key]} onChange={(e) => {
                          setProducts((prev) => prev.map((pp, i) => i === pIdx ? { ...pp, checklist: { ...pp.checklist, [item.key]: e.target.checked } } : pp));
                        }} className="rounded border-border text-primary focus:ring-primary" /><span className="text-sm font-medium">{item.label}</span>
                      </label>
                    ))}
                    <div>
                      <label className="block text-sm font-bold mb-2">Mining used?</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={p.checklist.miningUsed === true} onChange={() => {
                          setProducts((prev) => prev.map((pp, i) => i === pIdx ? { ...pp, checklist: { ...pp.checklist, miningUsed: true } } : pp));
                        }} className="text-primary" /> Yes</label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={p.checklist.miningUsed === false} onChange={() => {
                          setProducts((prev) => prev.map((pp, i) => i === pIdx ? { ...pp, checklist: { ...pp.checklist, miningUsed: false } } : pp));
                        }} className="text-primary" /> No</label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Customer Details */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="font-display text-2xl font-black text-foreground">Your Details</h2>
            <p className="text-sm text-muted-foreground">How can we reach you?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="block text-sm font-bold mb-1.5">Name *</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-bold mb-1.5">Mobile *</label><input type="text" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="10-digit" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
            </div>
            <div><label className="block text-sm font-bold mb-1.5">Email *</label><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
            <div><label className="block text-sm font-bold mb-1.5">Address *</label><input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="block text-sm font-bold mb-1.5">City *</label><input type="text" value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-bold mb-1.5">State *</label><input type="text" value={customerState} onChange={(e) => setCustomerState(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-bold mb-1.5">Pincode *</label><input type="text" value={customerPincode} onChange={(e) => setCustomerPincode(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
            </div>
            <div><label className="block text-sm font-bold mb-1.5">GST Number (Optional)</label><input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="e.g. 22AAAAA0000A1Z5" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
            <div className="border-t border-border pt-4">
              <h3 className="font-bold flex items-center gap-2 mb-3"><MapPin className="h-4 w-4 text-primary" /> Pickup Details</h3>
              <div><label className="block text-sm font-bold mb-1.5">Pickup Address (if different)</label><input type="text" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div><label className="block text-sm font-bold mb-1.5">Preferred Date</label><input type="date" value={preferredPickupDate} onChange={(e) => setPreferredPickupDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm" /></div>
                <div>
                  <label className="block text-sm font-bold mb-2">Preferred Time</label>
                  <div className="flex gap-2">
                    {TIME_SLOTS.map((t) => (
                      <button key={t.value} onClick={() => setPreferredTimeSlot(t.value)} className={`flex-1 rounded-xl border py-2 text-xs font-medium transition ${preferredTimeSlot === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}><Clock className="mx-auto h-4 w-4 mb-0.5" />{t.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="font-display text-2xl font-black text-foreground">Review & Submit</h2>

            {products.map((p, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface/50 p-4 space-y-2">
                <h3 className="font-bold text-sm text-primary">Product #{i + 1}: {p.category || 'N/A'}</h3>
                <div className="grid gap-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{p.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Brand</span><span className="font-medium">{p.brand}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Model</span><span className="font-medium">{p.model}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Condition</span><span className="font-medium">{CONDITIONS.find((c) => c.value === p.condition)?.label}</span></div>
                  {p.expectedPrice && <div className="flex justify-between"><span className="text-muted-foreground">Expected Price</span><span className="font-medium text-primary">₹{Number(p.expectedPrice).toLocaleString('en-IN')}</span></div>}
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-3">
              <h3 className="font-bold">Photos ({photos.length})</h3>
              {photos.filter((p) => p.needsReupload).length > 0 && <p className="text-xs text-destructive font-bold">Some photos need re-upload after refresh.</p>}
              {photos.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {photos.slice(0, 8).map((p, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border bg-surface">
                      <img src={p.preview} alt={p.type} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ))}
                  {photos.length > 8 && <div className="aspect-square flex items-center justify-center rounded-lg border bg-surface text-xs text-muted-foreground">+{photos.length - 8}</div>}
                </div>
              ) : <p className="text-sm text-muted-foreground">No photos yet.</p>}
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-3">
              <h3 className="font-bold">Videos ({videos.length})</h3>
              {videos.filter((v) => v.needsReupload).length > 0 && <p className="text-xs text-destructive font-bold">Some videos need re-upload after refresh.</p>}
              {videos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {videos.slice(0, 3).map((v, i) => (
                    <div key={i} className="rounded-lg overflow-hidden border border-border bg-surface">
                      <video src={v.preview} controls className="w-full h-24 object-cover" />
                    </div>
                  ))}
                  {videos.length > 3 && <div className="flex items-center justify-center rounded-lg border bg-surface text-xs text-muted-foreground h-24">+{videos.length - 3}</div>}
                </div>
              ) : <p className="text-sm text-muted-foreground">No videos yet.</p>}
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-2">
              <h3 className="font-bold">Your Details</h3>
              <p className="text-sm"><span className="text-muted-foreground">Name:</span> {customerName}</p>
              <p className="text-sm"><span className="text-muted-foreground">Mobile:</span> {customerMobile}</p>
              <p className="text-sm"><span className="text-muted-foreground">Email:</span> {customerEmail}</p>
              <p className="text-sm"><span className="text-muted-foreground">Address:</span> {customerAddress}, {customerCity}, {customerState} - {customerPincode}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={() => setStep((s: number) => Math.max(0, s - 1))} className={`flex items-center gap-1 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition ${step === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-accent/20'}`}><ChevronLeft className="h-4 w-4" /> Back</button>
        {step < 5 ? (
          <button onClick={() => setStep((s: number) => s + 1)} disabled={!canNext()} className="flex items-center gap-1 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-40 disabled:cursor-not-allowed">Next <ChevronRight className="h-4 w-4" /></button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-40">{submitting ? 'Submitting...' : 'Submit Sell Request'}</button>
        )}
      </div>
    </div>
  );
}
