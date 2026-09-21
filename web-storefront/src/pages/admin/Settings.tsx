import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { Save, Key, Truck, Mail, Percent, Store, Link2, Share2, ImageIcon, Trash2, Phone, Plus } from 'lucide-react';

const TABS = [
  { id: 'store', label: 'Store', icon: Store },
  { id: 'payment', label: 'Payment', icon: Key },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'gst', label: 'GST', icon: Percent },
  { id: 'social', label: 'Social & Footer', icon: Share2 },
  { id: 'banners', label: 'Banners', icon: ImageIcon },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AdminSettings() {
  const [tab, setTab] = useState<TabId>('store');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [srEmail, setSrEmail] = useState('');
  const [srPassword, setSrPassword] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromName, setFromName] = useState('PrimeX PC');
  const [fromAddress, setFromAddress] = useState('primexpc@gmail.com');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [storeState, setStoreState] = useState('');
  const [storePincode, setStorePincode] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storePhones, setStorePhones] = useState<{ label: string; number: string }[]>([]);
  const [storeEmail, setStoreEmail] = useState('');
  const [storeHours, setStoreHours] = useState('');
  const [storeWhatsapp, setStoreWhatsapp] = useState('');
  const [storeGstin, setStoreGstin] = useState('24ABCFP8750F1Z8');
  const [gstRates, setGstRates] = useState([{ name: '', rate: '' }]);
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string; active: boolean }[]>([
    { platform: 'Instagram', url: '', active: true },
    { platform: 'Facebook', url: '', active: true },
    { platform: 'LinkedIn', url: '', active: true },
    { platform: 'WhatsApp', url: '', active: true },
  ]);
  const [footerLinks, setFooterLinks] = useState<{ label: string; href: string }[]>([]);
  const [banners, setBanners] = useState<string[]>([]);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/settings').then((r) => {
      setKeyId(r.data.razorpay_key_id || '');
      setKeySecret(r.data.razorpay_key_secret || '');
      setWebhookSecret(r.data.razorpay_webhook_secret || '');
      setSrEmail(r.data.shiprocket_email || '');
      setSrPassword(r.data.shiprocket_password || '');
      setSmtpHost(r.data.smtp_host || '');
      setSmtpPort(r.data.smtp_port || '587');
      setSmtpUser(r.data.smtp_user || '');
      setSmtpPass(r.data.smtp_pass || '');
      setFromName(r.data.email_from_name || 'PrimeX PC');
      setFromAddress(r.data.email_from_address || 'noreply@primexpc.com');
      setStoreName(r.data.store_name || '');
      setStoreAddress(r.data.store_address || '');
      setStoreCity(r.data.store_city || '');
      setStoreState(r.data.store_state || '');
      setStorePincode(r.data.store_pincode || '');
      setStorePhone(r.data.store_phone || '');
      try {
        const phones = JSON.parse(r.data.store_phones || '[]');
        setStorePhones(Array.isArray(phones) ? phones.map((p: unknown) => (typeof p === 'string' ? { label: '', number: p } : (p as { label: string; number: string }))) : []);
      } catch { setStorePhones([]); }
      setStoreEmail(r.data.store_email || '');
      setStoreHours(r.data.store_hours || '');
      setStoreWhatsapp(r.data.store_whatsapp || '');
      setStoreGstin(r.data.store_gstin || '24ABCFP8750F1Z8');

      try { setGstRates(JSON.parse(r.data.gst_rates) || []); } catch { setGstRates([{ name: '18%', rate: '18' }]); }
      try { setSocialLinks(JSON.parse(r.data.social_links || '[]')); } catch {}
      try { setFooterLinks(JSON.parse(r.data.custom_footer_links || '[]')); } catch {}
      api.get('/settings/public/banners').then((br) => setBanners(Array.isArray(br.data) ? br.data : [])).catch(() => {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/admin/settings', {
        razorpay_key_id: keyId, razorpay_key_secret: keySecret, razorpay_webhook_secret: webhookSecret,
        shiprocket_email: srEmail, shiprocket_password: srPassword,
        smtp_host: smtpHost, smtp_port: smtpPort, smtp_user: smtpUser, smtp_pass: smtpPass,
        email_from_name: fromName, email_from_address: fromAddress,
        store_name: storeName, store_address: storeAddress, store_city: storeCity, store_state: storeState,
        store_pincode: storePincode, store_phone: storePhone,
        store_phones: JSON.stringify(storePhones.filter((p) => p.number.trim())),
        store_email: storeEmail,
        store_hours: storeHours, store_whatsapp: storeWhatsapp, store_gstin: storeGstin,
        gst_rates: JSON.stringify(gstRates),
        social_links: JSON.stringify(socialLinks),
        custom_footer_links: JSON.stringify(footerLinks),
      });
      setMsg('Settings saved');
    } catch { setMsg('Failed to save'); }
    finally { setSaving(false); }
  };

  const testEmail = async () => {
    setTestingEmail(true);
    setEmailMsg(null);
    try { await api.post('/admin/settings/test-email', {}); setEmailMsg('Test email sent!'); }
    catch { setEmailMsg('Failed to send test email'); }
    finally { setTestingEmail(false); }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-black">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Store, payment, shipping & email configuration.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
              tab === t.id ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 space-y-4">
        {tab === 'store' && (
          <>
            <Section icon={Store} title="Store Info">
              <Field label="Store Name" value={storeName} onChange={setStoreName} placeholder="PrimeX PC" />
              <Field label="Address" value={storeAddress} onChange={setStoreAddress} placeholder="Street address" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={storeCity} onChange={setStoreCity} placeholder="City" />
                <Field label="State" value={storeState} onChange={setStoreState} placeholder="State" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Pincode" value={storePincode} onChange={setStorePincode} placeholder="6-digit" />
                <Field label="Phone" value={storePhone} onChange={setStorePhone} placeholder="10-digit" />
                <Field label="Email" value={storeEmail} onChange={setStoreEmail} placeholder="email@..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Working Hours" value={storeHours} onChange={setStoreHours} placeholder="Mon - Sat : 10 AM - 7 PM" />
                <Field label="GSTIN" value={storeGstin} onChange={setStoreGstin} placeholder="24ABCFP8750F1Z8" />
              </div>
              <Field label="WhatsApp Number" value={storeWhatsapp} onChange={setStoreWhatsapp} placeholder="919971331723" />
            </Section>

            <Section icon={Phone} title="Store Phone Numbers (Shop par show thase)">
              <p className="text-xs text-muted-foreground">Jetla pan numbers add karva hoy e add karo — badha shop (website) par show thase.</p>
              <div className="space-y-2">
                {storePhones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={p.label}
                      onChange={(e) => {
                        const r = [...storePhones]; r[i] = { ...r[i], label: e.target.value };
                        setStorePhones(r);
                      }}
                      placeholder="Label (e.g. Sales)"
                      className="h-9 w-36 rounded-md border border-border bg-input px-2 text-sm"
                    />
                    <input
                      value={p.number}
                      onChange={(e) => {
                        const r = [...storePhones]; r[i] = { ...r[i], number: e.target.value };
                        setStorePhones(r);
                      }}
                      placeholder="10-digit number"
                      className="h-9 flex-1 rounded-md border border-border bg-input px-2 text-sm"
                    />
                    <button type="button" onClick={() => setStorePhones(storePhones.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setStorePhones([...storePhones, { label: '', number: '' }])} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add Phone Number
                </button>
              </div>
            </Section>
          </>
        )}

        {tab === 'payment' && (
          <Section icon={Key} title="Razorpay">
            <Field label="Key ID" value={keyId} onChange={setKeyId} placeholder="rzp_test_..." />
            <Field label="Key Secret" value={keySecret} onChange={setKeySecret} type="password" placeholder={keySecret ? '' : 'Enter new secret'} />
            <Field label="Webhook Secret" value={webhookSecret} onChange={setWebhookSecret} type="password" placeholder={webhookSecret ? '' : 'Enter new secret'} />
          </Section>
        )}

        {tab === 'shipping' && (
          <Section icon={Truck} title="Shiprocket">
            <Field label="Email" value={srEmail} onChange={setSrEmail} type="email" placeholder="shiprocket@email.com" />
            <Field label="Password" value={srPassword} onChange={setSrPassword} type="password" placeholder={srPassword ? '' : 'Enter new password'} />
          </Section>
        )}

        {tab === 'email' && (
          <Section icon={Mail} title="Email (SMTP)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="SMTP Host" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.gmail.com" />
              <Field label="Port" value={smtpPort} onChange={setSmtpPort} placeholder="587" />
            </div>
            <Field label="SMTP Username" value={smtpUser} onChange={setSmtpUser} placeholder="user@gmail.com" />
            <Field label="SMTP Password (App Password)" value={smtpPass} onChange={setSmtpPass} type="password" placeholder={smtpPass ? '' : 'Enter SMTP password'} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="From Name" value={fromName} onChange={setFromName} placeholder="PrimeX PC" />
              <Field label="From Email" value={fromAddress} onChange={setFromAddress} placeholder="noreply@primexpc.com" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={testEmail} disabled={testingEmail} className="rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
                {testingEmail ? 'Sending...' : 'Send Test Email'}
              </button>
              {emailMsg && <span className={`text-xs ${emailMsg.includes('Failed') ? 'text-destructive' : 'text-primary'}`}>{emailMsg}</span>}
            </div>
          </Section>
        )}

        {tab === 'gst' && (
          <Section icon={Percent} title="GST Rates">
            <div className="space-y-2">
              {gstRates.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={g.name} onChange={(e) => {
                    const r = [...gstRates]; r[i] = { ...r[i], name: e.target.value };
                    setGstRates(r);
                  }} placeholder="e.g. 18%" className="h-9 w-24 rounded-md border border-border bg-input px-2 text-sm" />
                  <input type="number" value={g.rate} onChange={(e) => {
                    const r = [...gstRates]; r[i] = { ...r[i], rate: e.target.value };
                    setGstRates(r);
                  }} placeholder="Rate" className="h-9 w-24 rounded-md border border-border bg-input px-2 text-sm" />
                  <button type="button" onClick={() => setGstRates(gstRates.filter((_, j) => j !== i))} className="text-xs text-destructive hover:underline">&times; Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setGstRates([...gstRates, { name: '', rate: '' }])} className="text-xs font-bold text-primary hover:underline">+ Add Rate</button>
            </div>
          </Section>
        )}

        {tab === 'social' && (
          <>
            <Section icon={Share2} title="Social Links">
              <p className="text-xs text-muted-foreground">Supported platforms: Facebook, Twitter/X, Instagram, YouTube, LinkedIn, WhatsApp</p>
              <div className="space-y-2">
                {socialLinks.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border hover:border-primary">
                      <input type="checkbox" checked={s.active} onChange={(e) => {
                        const r = [...socialLinks]; r[i] = { ...r[i], active: e.target.checked };
                        setSocialLinks(r);
                      }} className="h-4 w-4 accent-primary" />
                    </label>
                    <input value={s.platform} onChange={(e) => {
                      const r = [...socialLinks]; r[i] = { ...r[i], platform: e.target.value };
                      setSocialLinks(r);
                    }} placeholder="Platform" className="h-9 w-32 rounded-md border border-border bg-input px-2 text-sm" />
                    <input value={s.url} onChange={(e) => {
                      const r = [...socialLinks]; r[i] = { ...r[i], url: e.target.value };
                      setSocialLinks(r);
                    }} placeholder="https://..." className="h-9 flex-1 rounded-md border border-border bg-input px-2 text-sm" />
                    <button type="button" onClick={() => setSocialLinks(socialLinks.filter((_, j) => j !== i))} className="text-xs text-destructive hover:underline">&times;</button>
                  </div>
                ))}
                <button type="button" onClick={() => setSocialLinks([...socialLinks, { platform: '', url: '', active: true }])} className="text-xs font-bold text-primary hover:underline">+ Add Social Link</button>
              </div>
            </Section>

            <Section icon={Link2} title="Footer Links">
              <p className="text-xs text-muted-foreground">Custom links shown in the footer (e.g. About Us, Privacy Policy). Use /page/slug for CMS pages.</p>
              <div className="space-y-2">
                {footerLinks.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={f.label} onChange={(e) => {
                      const r = [...footerLinks]; r[i] = { ...r[i], label: e.target.value };
                      setFooterLinks(r);
                    }} placeholder="Label" className="h-9 w-36 rounded-md border border-border bg-input px-2 text-sm" />
                    <input value={f.href} onChange={(e) => {
                      const r = [...footerLinks]; r[i] = { ...r[i], href: e.target.value };
                      setFooterLinks(r);
                    }} placeholder="/page/slug or https://..." className="h-9 flex-1 rounded-md border border-border bg-input px-2 text-sm" />
                    <button type="button" onClick={() => setFooterLinks(footerLinks.filter((_, j) => j !== i))} className="text-xs text-destructive hover:underline">&times; Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => setFooterLinks([...footerLinks, { label: '', href: '' }])} className="text-xs font-bold text-primary hover:underline">+ Add Footer Link</button>
              </div>
            </Section>
          </>
        )}

        {tab === 'banners' && (
          <Section icon={ImageIcon} title="Banner Images (Max 6)">
            <p className="text-xs text-muted-foreground">Upload up to 6 banner images for the homepage slider. Recommended size: <strong>1280x512px (2.5:1 ratio)</strong>. Keep important content centered for mobile.</p>
            {bannerError && (
              <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{bannerError}</div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="relative flex aspect-[2.5/1] items-center justify-center rounded-lg border border-border bg-surface/40 overflow-hidden">
                  {banners[i] ? (
                    <>
                      <img src={getImageUrl(banners[i])} alt={`Banner ${i + 1}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={async () => {
                        try {
                          await api.delete(`/admin/settings/banners/${i}`);
                          setBanners((prev) => prev.filter((_, j) => j !== i));
                        } catch { setBannerError('Failed to delete banner'); }
                      }} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/80 text-white hover:bg-destructive transition">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Empty</span>
                  )}
                </div>
              ))}
            </div>
            {banners.length < 6 && (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition">
                <input type="file" accept="image/*" multiple className="hidden" disabled={bannerUploading}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    const remaining = 6 - banners.length;
                    const toUpload = Array.from(files).slice(0, remaining);
                    if (toUpload.length === 0) return;
                    setBannerUploading(true);
                    try {
                      setBannerError(null);
                      const fd = new FormData();
                      toUpload.forEach((f) => fd.append('banners', f));
                      const res = await api.post('/admin/settings/banners', fd, {
                        headers: { 'Content-Type': undefined }
                      });
                      setBanners(res.data.banners || []);
                    } catch (err: any) {
                      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Unknown error';
                      setBannerError('Upload failed: ' + errMsg);
                    }
                    finally { setBannerUploading(false); e.target.value = ''; }
                  }}
                />
                {bannerUploading ? 'Uploading...' : `+ Upload (${6 - banners.length} left)`}
              </label>
            )}
          </Section>
        )}

        {msg && (
          <div className={`rounded-md px-3 py-2 text-xs ${msg.includes('Failed') ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{msg}</div>
        )}

        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50">
          {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Settings</>}
        </button>
      </form>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 mb-3"><Icon className="h-5 w-5 text-primary" /><h3 className="font-display text-base font-bold uppercase tracking-wider">{title}</h3></div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
    </div>
  );
}
