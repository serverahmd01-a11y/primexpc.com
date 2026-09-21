import mongoose from "mongoose";
import { writeFileSync, existsSync, mkdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";
const DB_NAME = new URL(DB_URL).pathname.replace("/", "") || "primexpc";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(__dirname, "..", "backups", `${DB_NAME}_${timestamp}`);

const fmtKB = (bytes) => (bytes / 1024).toFixed(1) + " KB";

const backup = async () => {
  await mongoose.connect(DB_URL);
  const db = mongoose.connection.db;

  mkdirSync(backupDir, { recursive: true });

  const collections = await db.listCollections().toArray();
  const manifest = { db: DB_NAME, timestamp, collections: {} };
  let totalDocs = 0;
  let passed = true;

  console.log("==========================================");
  console.log(`BACKUP START — ${DB_NAME}`);
  console.log("==========================================");

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const json = JSON.stringify(docs, null, 2);
    const file = `${name}.json`;
    writeFileSync(path.join(backupDir, file), json, "utf-8");
    const bytes = Buffer.byteLength(json, "utf-8");
    manifest.collections[name] = { count: docs.length, bytes, file };
    totalDocs += docs.length;
    console.log(`  ✅ ${name.padEnd(24)} ${String(docs.length).padStart(8)} docs  ${fmtKB(bytes).padStart(10)}`);
  }

  writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  console.log("------------------------------------------");
  console.log(`  TOTAL: ${totalDocs} documents in ${collections.length} collections`);

  console.log("\nVERIFYING BACKUP FILES...");
  for (const [name, meta] of Object.entries(manifest.collections)) {
    const raw = readFileSync(path.join(backupDir, meta.file), "utf-8");
    const parsed = JSON.parse(raw);
    const fileBytes = statSync(path.join(backupDir, meta.file)).size;
    if (parsed.length === meta.count && fileBytes === meta.bytes) {
      console.log(`  ✅ ${name.padEnd(24)} file OK (${parsed.length} docs, ${fmtKB(fileBytes)})`);
    } else {
      passed = false;
      console.log(`  ❌ ${name.padEnd(24)} MISMATCH! expected ${meta.count} docs / ${meta.bytes} bytes, got ${parsed.length} / ${fileBytes}`);
    }
  }

  console.log("\n==========================================");
  console.log(passed
    ? `✅ BACKUP COMPLETE & VERIFIED — ${backupDir}`
    : "❌ BACKUP FAILED VERIFICATION — DO NOT USE THIS BACKUP");
  console.log("==========================================");

  await mongoose.connection.close();
  process.exit(passed ? 0 : 1);
};

backup().catch((e) => {
  console.error("❌ Backup failed:", e.message);
  process.exit(1);
});
