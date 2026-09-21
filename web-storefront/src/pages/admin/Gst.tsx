import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { adminApi } from '@/lib/api';
import type { Product } from '@/types';
import { Percent, Plus, Save, Trash2, Info } from 'lucide-react';

type GstRate = { name: string; rate: string };

export default function AdminGst() {
  const [rates, setRates] = useState<GstRate[]>([{ name: '18%', rate: '18' }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/settings').then((r) => {
        try { setRates(JSON.parse(r.data.gst_rates) || [{ name: '18%', rate: '18' }]); } catch { setRates([{ name: '18%', rate: '18' }]); }
      }),
      adminApi.getProducts(),
    ]).then(([, prods]) => setProducts(prods || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getProductCount = (rate: string) => products.filter((p) => String(p.gstRate || 18) === rate).length;

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put('/admin/settings', { gst_rates: JSON.stringify(rates) });
      setMsg('GST rates saved');
    } catch { setMsg('Failed to save'); }
    finally { setSaving(false); }
  };

  const addRate = () => setRates([...rates, { name: '', rate: '' }]);
  const removeRate = (i: number) => setRates(rates.filter((_, j) => j !== i));

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-xl font-black">GST Management</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure tax rates and view product distribution.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            <h3 className="font-display text-base font-bold uppercase tracking-wider">Tax Rates</h3>
          </div>
          <button onClick={addRate} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
            <Plus className="h-3.5 w-3.5" /> Add Rate
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Rate (%)</th>
                <th className="px-3 py-2">Products</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rates.map((g, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-3 py-2">
                    <input value={g.name} onChange={(e) => { const r = [...rates]; r[i] = { ...r[i], name: e.target.value }; setRates(r); }} placeholder="e.g. 18%" className="h-9 w-full rounded-md border border-border bg-input px-2 text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={g.rate} onChange={(e) => { const r = [...rates]; r[i] = { ...r[i], rate: e.target.value }; setRates(r); }} className="h-9 w-20 rounded-md border border-border bg-input px-2 text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {getProductCount(g.rate)} products
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeRate(i)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50">
            {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Rates</>}
          </button>
          {msg && <span className={`text-xs ${msg.includes('Failed') ? 'text-destructive' : 'text-primary'}`}>{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold uppercase tracking-wider">Summary</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {rates.map((g) => {
            const count = getProductCount(g.rate);
            const totalPrice = products.filter((p) => String(p.gstRate || 18) === g.rate).reduce((s, p) => s + p.price, 0);
            return (
              <div key={g.rate} className="rounded-lg bg-surface/40 p-3">
                <div className="text-xs text-muted-foreground">{g.name || g.rate + '%'}</div>
                <div className="font-display font-bold text-lg">{count}</div>
                <div className="text-[10px] text-muted-foreground">₹{totalPrice.toLocaleString('en-IN')} stock value</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
