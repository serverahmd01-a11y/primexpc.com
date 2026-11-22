import type { InvoiceItem } from '@/lib/utils';

// Builds invoice lines. "new" products: GST only on (margin - shipping).
// Fast delivery charges become their own invoice lines.
export function invoiceItemsFor(
  items: {
    name: string; price: number; quantity: number; gstRate?: number;
    margin?: number; shippingCost?: number; pricingMode?: 'old' | 'new'; fastDeliveryFee?: number;
  }[],
): InvoiceItem[] {
  const out: InvoiceItem[] = [];
  for (const i of items) {
    const line: InvoiceItem = { name: i.name, price: i.price, quantity: i.quantity, gstRate: i.gstRate || 18 };
    if (i.pricingMode === 'new') {
      line.taxableOverride = Math.max(0, (Number(i.margin) || 0) - (Number(i.shippingCost) || 0)) * i.quantity;
    }
    out.push(line);
    if (i.fastDeliveryFee && i.fastDeliveryFee > 0) {
      out.push({ name: `Fast Delivery - ${i.name}`, price: i.fastDeliveryFee, quantity: 1, gstRate: 18 });
    }
  }
  return out;
}
