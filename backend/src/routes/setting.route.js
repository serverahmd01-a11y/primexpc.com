import { Router } from "express";
import mongoose from "mongoose";
import JSZip from "jszip";
import * as BSON from "bson";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { getSettings, updateSettings, getPublicKey, uploadBanners, deleteBanner } from "../controllers/setting.controller.js";
import { sendTestEmail, sendEmail } from "../config/email.js";
import { getSetting } from "../models/setting.model.js";
import { upload } from "../middleware/multer.middleware.js";
import { logger, istDateString } from "../utils/logger.js";

const router = Router();

// One-click MongoDB backup download (pure-Node dump — works on any host,
// no mongodump binary needed). Single JSON file restorable via
// `node scripts/restore-db.js <file>`.
router.get("/backup", protectRoute, adminOnly, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const dump = {
      meta: {
        app: "primexpc",
        format: "single-file-v1",
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email || "admin",
      },
      collections: {},
    };
    let totalDocs = 0;
    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray();
      dump.collections[name] = docs;
      totalDocs += docs.length;
    }
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `primexpc-backup-${istDateString()}-${hhmm}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    logger.admin("INFO", "Database backup downloaded", { actor: req.user?.email, collections: collections.length, documents: totalDocs });
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    logger.admin("ERROR", "Database backup failed", { actor: req.user?.email, error: err.message });
    res.status(500).json({ error: "Backup failed" });
  }
});

// Standard mongodump-style backup: <db>/<collection>.bson + metadata.json
// in a zip — restorable with `mongorestore` or importable in MongoDB Compass.
router.get("/backup-mongo", protectRoute, adminOnly, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const dbName = db.databaseName || "primexpc";
    const zip = new JSZip();
    const dumpDir = zip.folder(dbName);
    const collections = await db.listCollections().toArray();
    let totalDocs = 0;

    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray();
      const chunks = [];
      for (const doc of docs) {
        chunks.push(BSON.serialize(doc));
      }
      dumpDir.file(`${name}.bson`, Buffer.concat(chunks));
      let indexes = [{ v: 2, key: { _id: 1 }, name: "_id_" }];
      try {
        indexes = await db.collection(name).indexes();
      } catch { /* fall back to the default _id index */ }
      dumpDir.file(`${name}.metadata.json`, JSON.stringify({ options: {}, indexes }));
      totalDocs += docs.length;
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${dbName}-dump-${istDateString()}-${hhmm}.zip"`);
    logger.admin("INFO", "MongoDB dump (BSON) downloaded", { actor: req.user?.email, database: dbName, collections: collections.length, documents: totalDocs, sizeKb: Math.round(buffer.length / 1024) });
    res.send(buffer);
  } catch (err) {
    logger.admin("ERROR", "MongoDB dump failed", { actor: req.user?.email, error: err.message });
    res.status(500).json({ error: "Dump failed" });
  }
});

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
    const { dispatchNotification } = await import("../config/notify.js");
    dispatchNotification("contact_form", {
      title: "📩 New Contact Form Message",
      lines: [
        `From: ${String(name).replace(/[<>"'&]/g, "")}`,
        `Email: ${String(email).replace(/[<>"'&]/g, "")}`,
        `Subject: ${String(subject || "-").replace(/[<>"'&]/g, "")}`,
        "",
        String(message).replace(/[<>"'&]/g, "").slice(0, 500),
      ],
    });
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

router.post("/test-notification", protectRoute, adminOnly, async (req, res) => {
  try {
    const { sendTestNotification } = await import("../config/notify.js");
    await sendTestNotification(String(req.body.channel || ""));
    res.status(200).json({ message: "Test notification sent" });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to send test notification" });
  }
});

export default router;
