import mongoose from "mongoose";
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";
const DB_NAME = new URL(DB_URL).pathname.replace("/", "") || "primexpc";

const backupPath = process.argv[2];
if (!backupPath || !existsSync(backupPath)) {
  console.error("Usage: node scripts/restore-db.js <backup-folder>");
  console.error("Example: node scripts/restore-db.js backups/primexpc_2026-06-29T10-00-00");
  process.exit(1);
}

const restore = async () => {
  try {
    await mongoose.connect(DB_URL);
    const db = mongoose.connection.db;

    const files = readdirSync(backupPath).filter((f) => f.endsWith(".json"));
    let totalDocs = 0;

    for (const file of files) {
      const collectionName = file.replace(".json", "");
      const data = JSON.parse(readFileSync(path.join(backupPath, file), "utf-8"));

      if (data.length > 0) {
        await db.collection(collectionName).deleteMany({});
        await db.collection(collectionName).insertMany(data);
        totalDocs += data.length;
        console.log(`   ✅ ${collectionName}: ${data.length} documents restored`);
      }
    }

    console.log(`\n📦 Restore complete! ${files.length} collections, ${totalDocs} total documents`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Restore failed:", err.message);
    process.exit(1);
  }
};

restore();
