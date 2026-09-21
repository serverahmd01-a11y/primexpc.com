import { getSetting } from "../models/setting.model.js";

export async function getShippingRates(req, res) {
  try {
    const { pincode } = req.query;

    if (!pincode || !/^\d{6}$/.test(String(pincode))) {
      return res.status(400).json({ error: "Valid 6-digit pincode required" });
    }

    const pickupPincode = await getSetting("store_pincode", "");

    res.status(200).json({
      serviceable: false,
      pickup_pincode: pickupPincode,
      delivery_pincode: pincode,
      couriers: [],
      message: "Serviceability is verified when your order ships",
    });
  } catch (error) {
    console.error("Shipping rates error:", error.message);
    res.status(200).json({
      serviceable: false,
      message: "Serviceability check failed",
      couriers: [],
    });
  }
}
