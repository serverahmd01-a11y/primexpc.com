import multer from "multer";
import path from "path";
import fs from "fs";
import { ENV } from "../config/env.js";
import { logger } from "../utils/logger.js";

const uploadsDir = ENV.UPLOADS_DIR;
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Created uploads directory:", uploadsDir);
    logger.upload("INFO", "Uploads folder created", { folder: uploadsDir });
  }
} catch (err) {
  console.error("Failed to create uploads directory:", uploadsDir, err.message);
  logger.upload("ERROR", "Failed to create uploads folder", { folder: uploadsDir, error: err.message });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpeg", ".jpg", ".png", ".webp", ".heic", ".heif", ".mp4", ".mov", ".webm", ".avi"].includes(ext) ? ext : ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = /\.(jpeg|jpg|png|webp|heic|heif|mp4|mov|webm|avi)$/i;
  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const allowedMimes = /^(image|video)\//;
  const mimeType = allowedMimes.test(file.mimetype);

  if (extname && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only image/video files allowed (jpeg, jpg, png, webp, heic, heif, mp4, mov, webm, avi)"));
  }
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 25 },
});

// Wraps a multer middleware so every upload is written to the "upload" log:
// original name, saved name, full disk path, size, URL, and whether the file
// really exists on disk after saving. Visible in Admin -> Logs -> Uploads.
function withUploadLog(mw) {
  return (req, res, next) => {
    const started = Date.now();
    mw(req, res, (err) => {
      const route = `${req.method} ${req.originalUrl}`;
      const user = req.user ? req.user.email || String(req.user._id) : "guest";
      if (err) {
        logger.upload("ERROR", "Upload rejected", { route, user, error: err.message, code: err.code });
        return next(err);
      }
      const files = req.file
        ? [req.file]
        : Array.isArray(req.files)
          ? req.files
          : req.files
            ? Object.values(req.files).flat()
            : [];
      for (const f of files) {
        let onDisk = false;
        let diskBytes = 0;
        try {
          const st = fs.statSync(f.path);
          onDisk = st.isFile();
          diskBytes = st.size;
        } catch { /* missing */ }
        logger.upload(onDisk ? "SUCCESS" : "ERROR", onDisk ? "File saved" : "File NOT found on disk after upload", {
          original: f.originalname,
          savedAs: f.filename,
          fullPath: f.path,
          folder: uploadsDir,
          url: `/uploads/${f.filename}`,
          sizeKB: Math.round((f.size || 0) / 1024),
          diskSizeKB: Math.round(diskBytes / 1024),
          type: f.mimetype,
          route,
          user,
          ms: Date.now() - started,
        });
      }
      next();
    });
  };
}

export const upload = {
  single: (field) => withUploadLog(multerUpload.single(field)),
  array: (field, max) => withUploadLog(multerUpload.array(field, max)),
  fields: (fields) => withUploadLog(multerUpload.fields(fields)),
  any: () => withUploadLog(multerUpload.any()),
};