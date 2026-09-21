import { Setting, getRazorpayKeys } from "../models/setting.model.js";

export async function getSettings(req, res) {
  try {
    const keys = await getRazorpayKeys();
    const { getSetting } = await import("../models/setting.model.js");
    res.status(200).json({
      razorpay_key_id: keys.key_id,
      razorpay_key_secret: keys.key_secret ? "••••••••" : "",
      razorpay_webhook_secret: keys.webhook_secret ? "••••••••" : "",
      shiprocket_email: await getSetting("shiprocket_email", ""),
      shiprocket_password: await getSetting("shiprocket_password", "") ? "••••••••" : "",
      smtp_host: await getSetting("smtp_host", ""),
      smtp_port: await getSetting("smtp_port", "587"),
      smtp_user: await getSetting("smtp_user", ""),
      smtp_pass: await getSetting("smtp_pass", "") ? "••••••••" : "",
      email_from_name: await getSetting("email_from_name", "PrimeX PC"),
      email_from_address: await getSetting("email_from_address", "noreply@primexpc.com"),
      store_name: await getSetting("store_name", ""),
      store_address: await getSetting("store_address", ""),
      store_city: await getSetting("store_city", ""),
      store_state: await getSetting("store_state", ""),
      store_pincode: await getSetting("store_pincode", ""),
      store_phone: await getSetting("store_phone", ""),
      store_phones: await getSetting("store_phones", "[]"),
      store_email: await getSetting("store_email", ""),
      store_hours: await getSetting("store_hours", "Mon - Sat : 10 AM - 7 PM"),
      store_whatsapp: await getSetting("store_whatsapp", "919971331723"),
      store_gstin: await getSetting("store_gstin", "24ABCFP8750F1Z8"),
      gst_rates: await getSetting("gst_rates", JSON.stringify([
        { name: "5%", rate: 5 },
        { name: "12%", rate: 12 },
        { name: "18%", rate: 18 },
        { name: "28%", rate: 28 },
      ])),
      social_links: await getSetting("social_links", "[]"),
      custom_footer_links: await getSetting("custom_footer_links", "[]"),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
}

export async function updateSettings(req, res) {
  try {
    const {
      razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret,
      shiprocket_email, shiprocket_password,
      smtp_host, smtp_port, smtp_user, smtp_pass,
      email_from_name, email_from_address, gst_rates,
      store_name, store_address, store_city, store_state, store_pincode, store_phone, store_phones, store_email,
      store_hours, store_whatsapp, store_gstin,
      social_links, custom_footer_links,
    } = req.body;

    const set = async (key, val, masked = "••••••••") => {
      if (val !== undefined && val !== masked) {
        await Setting.findOneAndUpdate({ key }, { value: val }, { upsert: true });
      }
    };

    await set("razorpay_key_id", razorpay_key_id, "");
    await set("razorpay_key_secret", razorpay_key_secret);
    await set("razorpay_webhook_secret", razorpay_webhook_secret);
    await set("shiprocket_email", shiprocket_email, "");
    await set("shiprocket_password", shiprocket_password);
    await set("smtp_host", smtp_host, "");
    await set("smtp_port", smtp_port, "");
    await set("smtp_user", smtp_user, "");
    await set("smtp_pass", smtp_pass);
    await set("email_from_name", email_from_name, "");
    await set("email_from_address", email_from_address, "");
    if (gst_rates !== undefined) {
      await set("gst_rates", typeof gst_rates === "string" ? gst_rates : JSON.stringify(gst_rates), "");
    }
    await set("store_name", store_name, "");
    await set("store_address", store_address, "");
    await set("store_city", store_city, "");
    await set("store_state", store_state, "");
    await set("store_pincode", store_pincode, "");
    await set("store_phone", store_phone, "");
    if (store_phones !== undefined) {
      const phones = typeof store_phones === "string" ? store_phones : JSON.stringify(store_phones);
      await set("store_phones", phones, "");
    }
    await set("store_email", store_email, "");
    await set("store_hours", store_hours, "");
    await set("store_whatsapp", store_whatsapp, "");
    await set("store_gstin", store_gstin, "");
    if (social_links !== undefined) {
      await set("social_links", typeof social_links === "string" ? social_links : JSON.stringify(social_links), "");
    }
    if (custom_footer_links !== undefined) {
      await set("custom_footer_links", typeof custom_footer_links === "string" ? custom_footer_links : JSON.stringify(custom_footer_links), "");
    }

    res.status(200).json({ message: "Settings updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
}

export async function uploadBanners(req, res) {
  try {
    const { getSetting, setSetting } = await import("../models/setting.model.js");
    const existing = JSON.parse(await getSetting("banner_images", "[]"));
    const files = req.files || [];
    const newPaths = files.map((f) => `/uploads/${f.filename}`);
    const combined = [...existing, ...newPaths].slice(0, 6);
    await setSetting("banner_images", JSON.stringify(combined));
    res.status(200).json({ banners: combined, message: "Banners uploaded" });
  } catch (error) {
    console.error("Upload banners error:", error.message);
    res.status(500).json({ error: "Failed to upload banners" });
  }
}

export async function deleteBanner(req, res) {
  try {
    const { getSetting, setSetting } = await import("../models/setting.model.js");
    const index = parseInt(req.params.index, 10);
    const banners = JSON.parse(await getSetting("banner_images", "[]"));
    if (index < 0 || index >= banners.length) {
      return res.status(400).json({ error: "Invalid index" });
    }
    banners.splice(index, 1);
    await setSetting("banner_images", JSON.stringify(banners));
    res.status(200).json({ banners, message: "Banner removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
}

export async function getPublicKey(req, res) {
  try {
    const { getSetting } = await import("../models/setting.model.js");
    const keyId = await getSetting("razorpay_key_id", process.env.RAZORPAY_KEY_ID || "");
    res.status(200).json({ key_id: keyId });
  } catch {
    res.status(200).json({ key_id: process.env.RAZORPAY_KEY_ID || "" });
  }
}
