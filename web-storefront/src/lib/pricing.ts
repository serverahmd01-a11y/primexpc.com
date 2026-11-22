import { useEffect, useState } from 'react';
import type { InvoiceItem } from '@/lib/utils';

// The customer's Fast Delivery choice is shared by the cart and checkout pages.
const FAST_KEY = 'primex_fast_delivery';
const FAST_EVENT = 'primex-fast-delivery';

function readFastDelivery(): boolean {
  try { return localStorage.getItem(FAST_KEY) === '1'; } catch { return false; }
}

export function useFastDelivery(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState<boolean>(readFastDelivery);
  useEffect(() => {
    const sync = () => setOn(readFastDelivery());
    window.addEventListener(FAST_EVENT, sync);
    return () => window.removeEventListener(FAST_EVENT, sync);
  }, []);
  const set = (v: boolean) => {
    try { localStorage.setItem(FAST_KEY, v ? '1' : '0'); } catch { /* private mode */ }
    window.dispatchEvent(new Event(FAST_EVENT));
  };
  return [on, set];
}

// Per-product pricing. Each product has pricingMode "old" | "new" (set in admin product form).
export const FAST_DELIVERY_FEE = 1000;
export const FAST_DELIVERY_MIN_PRICE = 30000;

// Builds invoice lines. For "new" products GST is taken on (margin - shipping) only.
// The fast delivery fee becomes its own line so it appears on the invoice.
export function invoiceItemsFor(
  items: { name: string; price: number; quantity: number; gstRate?: number; margin?: number; shippingCost?: number; pricingMode?: 'old' | 'new' }[],
  fastFee = 0,
): InvoiceItem[] {
  const out: InvoiceItem[] = items.map((i) => {
    const line: InvoiceItem = { name: i.name, price: i.price, quantity: i.quantity, gstRate: i.gstRate || 18 };
    if (i.pricingMode === 'new') {
      line.taxableOverride = Math.max(0, (Number(i.margin) || 0) - (Number(i.shippingCost) || 0)) * i.quantity;
    }
    return line;
  });
  if (fastFee > 0) out.push({ name: 'Fast Delivery', price: fastFee, quantity: 1, gstRate: 18 });
  return out;
}
