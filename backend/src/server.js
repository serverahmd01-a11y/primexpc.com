import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import { logger } from "./utils/logger.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.route.js";
import adminRoutes from "./routes/admin.route.js";
import userRoutes from "./routes/user.route.js";
import orderRoutes from "./routes/order.route.js";
import reviewRoutes from "./routes/review.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import categoryRoutes from "./routes/category.route.js";
import settingRoutes from "./routes/setting.route.js";
import shiprocketRoutes from "./routes/shiprocket.route.js";
import shippingRoutes from "./routes/shipping.route.js";
import paymentRoutes from "./routes/payment.route.js";
import notifyRoutes from "./routes/notify.route.js";
import pageRoutes from "./routes/page.route.js";
import sellRoutes from "./routes/sell.route.js";
import sellAdminRoutes from "./routes/sellAdmin.route.js";
import sellPublicRoutes from "./routes/sellPublic.route.js";

import {
  securityHeaders,
  generalLimiter,
  mongoSanitize,
  xss,
  hpp,
} from "./middleware/security.middleware.js";

import { handleWebhook } from "./controllers/payment.controller.js";
import { startReportBot } from "./config/telegramReportBot.js";
import { handleShiprocketWebhook } from "./controllers/sell.controller.js";
import { getSitemap } from "./controllers/sitemap.controller.js";
import { protectRoute, adminOnly } from "./middleware/auth.middleware.js";
import { getLogs, getAvailableLogFiles, getLogFilePath, istDateString, LOG_TYPES, LOG_DIR } from "./utils/logger.js";
import { Product } from "./models/product.model.js";
import { Category } from "./models/category.model.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(securityHeaders);

app.set("trust proxy", 1);

app.post("/api/payment/webhook", express.raw({ type: "application/json", limit: "256kb" }), handleWebhook);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    logger.error("ERROR", "Invalid JSON body received", {
      url: req.originalUrl,
      method: req.method,
      contentType: req.headers["content-type"],
      error: err.message,
    });
    return res.status(400).json({ error: "Invalid request body - JSON parse error" });
  }
  next(err);
});

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

app.use(cors({
  origin: [
    ENV.CLIENT_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "https://primexpc.com",
    "https://www.primexpc.com"
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-id"],
}));

app.use("/uploads", express.static(ENV.UPLOADS_DIR, {
  maxAge: "1d",
  dotfiles: "deny",
  index: false,
}));

app.use(generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/admin/shiprocket", shiprocketRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/admin/settings", settingRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/admin/categories", categoryRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin/notify-channels", notifyRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/admin/pages", pageRoutes);
app.use("/api/sell", sellRoutes);
app.use("/api/admin/sell", sellAdminRoutes);
app.use("/api/public", sellPublicRoutes);

app.post("/api/sell/webhook", express.raw({ type: "application/json", limit: "256kb" }), handleShiprocketWebhook);

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.get("/api/admin/logs/files", protectRoute, adminOnly, (req, res) => {
  try {
    const files = getAvailableLogFiles();
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/logs/download", protectRoute, adminOnly, (req, res) => {
  try {
    const { type, date } = req.query;
    const day = String(date || istDateString());

    if (type === "all") {
      const parts = [];
      for (const t of LOG_TYPES) {
        const file = getLogFilePath(t, day);
        if (file && fs.existsSync(file)) {
          parts.push(`===== ${t} (${day}) =====\n`);
          parts.push(fs.readFileSync(file, "utf-8"));
          parts.push("\n");
        }
      }
      if (parts.length === 0) return res.status(404).json({ error: "Log file not found" });
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="all_${day}.log"`);
      return res.send(parts.join(""));
    }

    const file = getLogFilePath(String(type), day);
    if (!file || !fs.existsSync(file)) {
      return res.status(404).json({ error: "Log file not found" });
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${type}_${day}.log"`);
    res.send(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload diagnostics: which folder the app saves to, whether it is writable,
// latest files on disk, stray "uploads" folders elsewhere, and DB image
// references whose file is missing on disk.
app.get("/api/admin/uploads/status", protectRoute, adminOnly, async (req, res) => {
  const dir = ENV.UPLOADS_DIR;
  const result = {
    envValue: process.env.UPLOADS_DIR || null,
    folder: dir,
    cwd: process.cwd(),
    logsFolder: LOG_DIR,
    exists: false,
    writable: false,
    error: null,
    totalFiles: 0,
    totalSizeMB: 0,
    recent: [],
    otherFolders: [],
    db: null,
  };
  let onDisk = new Set();
  try {
    result.exists = fs.existsSync(dir);
    if (result.exists) {
      const probe = path.join(dir, ".write-test");
      try {
        fs.writeFileSync(probe, "ok");
        fs.unlinkSync(probe);
        result.writable = true;
      } catch (e) {
        result.error = e.message;
      }
      const files = [];
      for (const name of fs.readdirSync(dir)) {
        try {
          const st = fs.statSync(path.join(dir, name));
          if (!st.isFile()) continue;
          files.push({ name, size: st.size, mtime: st.mtimeMs });
        } catch { /* skip */ }
      }
      onDisk = new Set(files.map((f) => f.name));
      result.totalFiles = files.length;
      result.totalSizeMB = +(files.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(2);
      result.recent = files
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 30)
        .map((f) => ({
          name: f.name,
          sizeKB: Math.round(f.size / 1024),
          modified: new Date(f.mtime).toISOString(),
          url: `/uploads/${f.name}`,
        }));
    }
  } catch (e) {
    result.error = e.message;
  }

  const candidates = [
    path.join(process.cwd(), "uploads"),
    path.join(__dirname, "..", "uploads"),
  ];
  for (const c of [...new Set(candidates.map((p) => path.resolve(p)))]) {
    if (c === path.resolve(dir)) continue;
    try {
      if (fs.existsSync(c)) {
        result.otherFolders.push({ folder: c, files: fs.readdirSync(c).length });
      }
    } catch { /* skip */ }
  }

  try {
    const refs = [];
    const products = await Product.find({}, { name: 1, images: 1, video: 1 }).lean();
    for (const p of products) {
      for (const img of [...(p.images || []), p.video].filter(Boolean)) {
        refs.push({ where: `Product: ${p.name}`, url: img });
      }
    }
    const cats = await Category.find({}, { name: 1, image: 1 }).lean();
    for (const c of cats) if (c.image) refs.push({ where: `Category: ${c.name}`, url: c.image });
    const local = refs.filter((r) => typeof r.url === "string" && r.url.includes("/uploads/"));
    const missing = local.filter((r) => !onDisk.has(path.basename(r.url.split("/uploads/")[1] || "")));
    result.db = {
      totalRefs: refs.length,
      localRefs: local.length,
      externalRefs: refs.length - local.length,
      missingCount: missing.length,
      missing: missing.slice(0, 100),
    };
  } catch (e) {
    result.db = { error: e.message };
  }

  res.json(result);
});

// Normalize "2026-10-24T17:12:06.379Z" (legacy UTC lines) and
// "2026-10-24 23:11:35 IST" into one comparable IST-based key.
function logTsKey(ts) {
  if (typeof ts !== "string") return "";
  if (ts.includes("T")) {
    const d = new Date(ts);
    if (!isNaN(d)) {
      return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
    }
  }
  return ts.replace(" IST", "");
}

app.get("/api/admin/logs", protectRoute, adminOnly, (req, res) => {
  try {
    const { type, date } = req.query;
    const day = String(date || istDateString());

    // "all" merges every log type into one timeline so the admin can see
    // the full story of a transaction in one place.
    if (type === "all") {
      const merged = [];
      for (const t of LOG_TYPES) {
        for (const entry of getLogs(t, day)) {
          merged.push({ ...entry, type: t });
        }
      }
      merged.sort((a, b) => {
        const ka = logTsKey(a.timestamp);
        const kb = logTsKey(b.timestamp);
        return ka < kb ? 1 : ka > kb ? -1 : 0;
      });
      return res.json({ type, date: day, logs: merged });
    }

    if (!type) return res.status(400).json({ error: "type query param required" });
    const logs = getLogs(type, day);
    res.json({ type, date: day, logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/sitemap.xml", getSitemap);

app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: *
Allow: /
Sitemap: ${ENV.CLIENT_URL || "https://primexpc.com"}/sitemap.xml
`);
});

if (ENV.NODE_ENV === "production") {
  const storefrontCandidates = [
    path.join(__dirname, "..", "dist"),
    path.join(__dirname, "..", "..", "web-storefront", "dist"),
    path.join(process.cwd(), "dist"),
  ];
  const storefrontDist = storefrontCandidates.find((p) => fs.existsSync(p));
  if (storefrontDist) {
    console.log("Serving storefront from:", storefrontDist);
    app.use(express.static(storefrontDist));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/uploads/")) {
        const filePath = path.join(storefrontDist, "index.html");
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
      return next();
    });
  } else {
    console.warn("Storefront dist not found. Looked in:", storefrontCandidates.join(", "));
  }
}

const checkUploadsDir = () => {
  const info = {
    envValue: process.env.UPLOADS_DIR || "(not set - using default)",
    folder: ENV.UPLOADS_DIR,
    cwd: process.cwd(),
    logsFolder: LOG_DIR,
  };
  console.log("UPLOADS_DIR env value:", info.envValue);
  console.log("Uploads folder in use:", info.folder);
  try {
    fs.mkdirSync(ENV.UPLOADS_DIR, { recursive: true });
    const probe = path.join(ENV.UPLOADS_DIR, ".write-test");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    const count = fs.readdirSync(ENV.UPLOADS_DIR).length;
    console.log("Uploads folder is writable:", count, "files inside");
    logger.upload("SUCCESS", "Server started - uploads folder OK", { ...info, writable: true, files: count });
  } catch (err) {
    console.error("Uploads folder NOT writable:", ENV.UPLOADS_DIR, err.message);
    logger.upload("ERROR", "Server started - uploads folder NOT writable", { ...info, writable: false, error: err.message });
  }
};

const startServer = async () => {
  checkUploadsDir();
  await connectDB();
  startReportBot();
  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
  });
};

process.on("unhandledRejection", (reason) => {
  logger.error("FATAL", "Unhandled promise rejection", { reason: String(reason) });
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("FATAL", "Uncaught exception", { message: error.message, stack: error.stack });
  console.error("Uncaught exception:", error);
  process.exit(1);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large (max 50MB)"
          : err.code === "LIMIT_FILE_COUNT"
            ? "Too many files in one upload"
            : err.message || "Upload failed",
    });
  }
  if (err?.message?.includes("Only image/video")) {
    return res.status(400).json({ message: err.message });
  }
  logger.error("FATAL", "Unhandled error", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

startServer();
