import { getSetting } from "../models/setting.model.js";

// Pricing mode is switched by admin (Settings -> Pricing mode).
// "old" = existing behaviour (price is treated exactly as before).
// "new" = price is GST-inclusive; GST is charged only on (margin - shipping).
export const FAST_DELIVERY_FEE = 1000;
export const FAST_DELIVERY_MIN_PRICE = 30000;

export async function getPricingMode() {
  const v = await getSetting("pricing_mode", "old");
  return v === "new" ? "new" : "old";
}
