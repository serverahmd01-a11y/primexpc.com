import mongoose from "mongoose";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";
const DB_NAME = new URL(DB_URL).pathname.replace("/", "") || "primexpc";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(__dirname, "..", "backups", `${DB_NAME}_${timestamp}`);

if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

const backup = async () => {
  try {
    await mongoose.connect(DB_URL);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    let totalDocs = 0;

    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray();
      const filePath = path.join(backupDir, `${name}.json`);
      writeFileSync(filePath, JSON.stringify(docs, null, 2));
      totalDocs += docs.length;
      console.log(`   ✅ ${name}: ${docs.length} documents`);
    }

    console.log(`\n📦 Backup complete! ${collections.length} collections, ${totalDocs} total documents`);
    console.log(`📁 Saved to: ${backupDir}`);
    console.log(`\n💡 To restore: node scripts/restore-db.js "${backupDir}"`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Backup failed:", err.message);
    process.exit(1);
  }
};

backup();

