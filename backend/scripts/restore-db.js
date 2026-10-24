import mongoose from "mongoose";
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";
const DB_NAME = new URL(DB_URL).pathname.replace("/", "") || "primexpc";

const backupPath = process.argv[2];
if (!backupPath || !existsSync(backupPath)) {
  console.error("Usage: node scripts/restore-db.js <backup-folder OR backup-file.json>");
  console.error("Example (folder):  node scripts/restore-db.js backups/primexpc_2026-06-29T10-00-00");
  console.error("Example (file):    node scripts/restore-db.js primexpc-backup-2026-10-24-2330.json");
  process.exit(1);
}

// Builds [{ collectionName, docs }] from either the legacy per-collection
// folder format or the single-file download from Admin → Settings → Backup.
async function readBackup() {
  const stat = await import("fs").then((fs) => fs.statSync(backupPath));
  if (stat.isFile()) {
    const data = JSON.parse(readFileSync(backupPath, "utf-8"));
    if (!data.collections || typeof data.collections !== "object") {
      throw new Error("Not a valid single-file backup (missing .collections)");
    }
    return Object.entries(data.collections).map(([collectionName, docs]) => ({ collectionName, docs }));
  }
  const files = readdirSync(backupPath).filter((f) => f.endsWith(".json"));
  return files.map((file) => ({
    collectionName: file.replace(".json", ""),
    docs: JSON.parse(readFileSync(path.join(backupPath, file), "utf-8")),
  }));
}

const restore = async () => {
  try {
    await mongoose.connect(DB_URL);
    const db = mongoose.connection.db;

    const entries = await readBackup();
    let totalDocs = 0;

    for (const { collectionName, docs } of entries) {
      if (Array.isArray(docs) && docs.length > 0) {
        await db.collection(collectionName).deleteMany({});
        await db.collection(collectionName).insertMany(docs);
        totalDocs += docs.length;
        console.log(`   ✅ ${collectionName}: ${docs.length} documents restored`);
      }
    }

    console.log(`\n📦 Restore complete! ${entries.length} collections, ${totalDocs} total documents`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Restore failed:", err.message);
    process.exit(1);
  }
};

restore();
