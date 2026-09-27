import mongoose from "mongoose";
import { ENV } from "../config/env.js";

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, default: "" },
}, { timestamps: true });

export const Setting = mongoose.model("Setting", settingSchema);

export async function getSetting(key, defaultValue = "") {
  const s = await Setting.findOne({ key });
  return s ? s.value : defaultValue;
}

export async function setSetting(key, value) {
  return Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
}

export async function getRazorpayKeys() {
  const key_id = (await getSetting("razorpay_key_id")) || ENV.RAZORPAY_KEY_ID || "";
  const key_secret = (await getSetting("razorpay_key_secret")) || ENV.RAZORPAY_KEY_SECRET || "";
  const webhook_secret = (await getSetting("razorpay_webhook_secret")) || ENV.RAZORPAY_WEBHOOK_SECRET || "";
  return { key_id, key_secret, webhook_secret };
}
