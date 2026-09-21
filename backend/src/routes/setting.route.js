import { Router } from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { getSettings, updateSettings, getPublicKey, uploadBanners, deleteBanner } from "../controllers/setting.controller.js";
import { sendTestEmail, sendEmail } from "../config/email.js";
import { getSetting } from "../models/setting.model.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

router.get("/public-key", getPublicKey);
router.get("/", protectRoute, adminOnly, getSettings);
router.put("/", protectRoute, adminOnly, updateSettings);
router.post("/banners", protectRoute, adminOnly, upload.array("banners", 6), uploadBanners);
router.delete("/banners/:index", protectRoute, adminOnly, deleteBanner);

router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required" });
    }
    const storeEmail = await getSetting("store_email", "primexpc24@gmail.com");
    await sendEmail({
      to: storeEmail,
      subject: `Contact Form: ${subject || "New Inquiry"}`,
      html: `<div style="max-width:600px;margin:auto;font-family:Arial;background:#121212;color:#e0e0e0;padding:24px;border-radius:12px;border:1px solid #333">
        <h2 style="color:#10b981">New Contact Form Submission</h2>
        <p><b>Name:</b> ${String(name).replace(/[<>"'&]/g, "")}</p>
        <p><b>Email:</b> ${String(email).replace(/[<>"'&]/g, "")}</p>
        <p><b>Subject:</b> ${String(subject || "").replace(/[<>"'&]/g, "")}</p>
        <p><b>Message:</b></p>
        <p style="background:#1a1a1a;padding:16px;border-radius:8px">${String(message).replace(/[<>"'&]/g, "").replace(/\n/g, "<br>")}</p>
      </div>`,
    });
    res.status(200).json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/public/store-info", async (req, res) => {
  try {
    let phones = [];
    try {
      phones = JSON.parse(await getSetting("store_phones", "[]"));
      if (!Array.isArray(phones)) phones = [];
    } catch {
      phones = [];
    }
    const data = {
      store_name: await getSetting("store_name", "PrimeX PC"),
      store_address: await getSetting("store_address", ""),
      store_city: await getSetting("store_city", "Ahmedabad"),
      store_state: await getSetting("store_state", "Gujarat"),
      store_pincode: await getSetting("store_pincode", "380054"),
      store_phone: await getSetting("store_phone", "9911652153"),
      store_phones: phones,
      store_email: await getSetting("store_email", "primexpc24@gmail.com"),
      store_hours: await getSetting("store_hours", "Mon - Sat : 10 AM - 7 PM"),
      store_whatsapp: await getSetting("store_whatsapp", "919971331723"),
      store_gstin: await getSetting("store_gstin", "24ABCFP8750F1Z8"),
    };
    res.status(200).json(data);
  } catch {
    res.status(200).json({
      store_name: "PrimeX PC", store_address: "", store_city: "Ahmedabad",
      store_state: "Gujarat", store_pincode: "380054", store_phone: "9911652153",
      store_phones: [], store_email: "primexpc24@gmail.com",
      store_hours: "Mon - Sat : 10 AM - 7 PM",
      store_whatsapp: "919971331723", store_gstin: "24ABCFP8750F1Z8",
    });
  }
});
router.get("/public/footer", async (req, res) => {
  try {
    const social = await getSetting("social_links", "[]");
    const footer = await getSetting("custom_footer_links", "[]");
    res.status(200).json({
      social_links: JSON.parse(social),
      custom_footer_links: JSON.parse(footer),
    });
  } catch {
    res.status(200).json({ social_links: [], custom_footer_links: [] });
  }
});
router.get("/public/banners", async (req, res) => {
  try {
    const banners = await getSetting("banner_images", "[]");
    res.status(200).json(JSON.parse(banners));
  } catch {
    res.status(200).json([]);
  }
});
router.get("/public/gst-rates", async (req, res) => {
  try {
    const rates = await getSetting("gst_rates", JSON.stringify([
      { name: "5%", rate: 5 }, { name: "12%", rate: 12 }, { name: "18%", rate: 18 }, { name: "28%", rate: 28 }
    ]));
    res.status(200).json(JSON.parse(rates));
  } catch {
    res.status(200).json([{ name: "18%", rate: 18 }]);
  }
});
router.post("/test-email", protectRoute, adminOnly, async (req, res) => {
  try {
    await sendTestEmail(req.body.email || req.user.email);
    res.status(200).json({ message: "Test email sent" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

export default router;
