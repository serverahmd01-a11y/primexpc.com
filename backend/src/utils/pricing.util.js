// Per-product pricing: each product has pricingMode "old" | "new".
// "old" = price as before (GST inside price, taxed on full price).
// "new" = GST only on (margin - shipping). Fast delivery applies to "new" items.
export const FAST_DELIVERY_FEE = 1000;
export const FAST_DELIVERY_MIN_PRICE = 30000;
