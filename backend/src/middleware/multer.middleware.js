import multer from "multer";
import path from "path";
import fs from "fs";
import { ENV } from "../config/env.js";

const uploadsDir = ENV.UPLOADS_DIR;
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Created uploads directory:", uploadsDir);
  }
} catch (err) {
  console.error("Failed to create uploads directory:", uploadsDir, err.message);
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

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 25 },
});