import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { InvoiceItem } from '@/lib/utils';

// "old" = current pricing (unchanged). "new" = margin/shipping pricing + fast delivery.
// Admin switches this in Settings -> Pricing.
export const FAST_DELIVERY_FEE = 1000;
export const FAST_DELIVERY_MIN_PRICE = 30000;
export type PricingMode = 'old' | 'new';

let cachedMode: PricingMode | null = null;
let pending: Promise<PricingMode> | null = null;

function loadMode(): Promise<PricingMode> {
  if (cachedMode) return Promise.resolve(cachedMode);
  if (!pending) {
    pending = api.get('/settings/public/pricing')
      .then((r) => { cachedMode = r.data?.mode === 'new' ? 'new' : 'old'; return cachedMode; })
      .catch((): PricingMode => 'old')
      .finally(() => { pending = null; });
  }
  return pending;
}

export function usePricingMode(): PricingMode {
  const [mode, setMode] = useState<PricingMode>(cachedMode || 'old');
  useEffect(() => {
    let alive = true;
    loadMode().then((m) => { if (alive) setMode(m); });
    return () => { alive = false; };
  }, []);
  return mode;
}

// Builds invoice lines. In "new" mode GST is taken on (margin - shipping) only.
// The fast delivery fee becomes its own line so it appears on the invoice.
export function invoiceItemsFor(
  items: { name: string; price: number; quantity: number; gstRate?: number; margin?: number; shippingCost?: number }[],
  mode: PricingMode,
  fastFee = 0,
): InvoiceItem[] {
  const out: InvoiceItem[] = items.map((i) => {
    const line: InvoiceItem = { name: i.name, price: i.price, quantity: i.quantity, gstRate: i.gstRate || 18 };
    if (mode === 'new') {
      line.taxableOverride = Math.max(0, (Number(i.margin) || 0) - (Number(i.shippingCost) || 0)) * i.quantity;
    }
    return line;
  });
  if (fastFee > 0) out.push({ name: 'Fast Delivery', price: fastFee, quantity: 1, gstRate: 18 });
  return out;
}
