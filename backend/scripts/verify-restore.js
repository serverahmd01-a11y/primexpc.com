import mongoose from "mongoose";
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";
const TEST_DB_NAME = "primexpc_restore_test";

const backupPath = process.argv[2];
if (!backupPath || !existsSync(backupPath)) {
  console.error("Usage: node scripts/verify-restore.js <backup-folder>");
  console.error("Example: node scripts/verify-restore.js backups/primexpc_2026-09-16T10-00-00");
  process.exit(1);
}

const manifestPath = path.join(backupPath, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error("❌ manifest.json not found in backup folder. Use full-backup.js to create backups.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const verify = async () => {
  const url = new URL(DB_URL);
  const testUrl = `${url.protocol}//${url.username ? url.username + ":" + url.password + "@" : ""}${url.host}/${TEST_DB_NAME}${url.search}`;

  console.log("==========================================");
  console.log(`RESTORE TEST — into TEMP DB: ${TEST_DB_NAME}`);
  console.log("(live database ne touch thatu nathi)");
  console.log("==========================================");

  await mongoose.connect(testUrl);
  const db = mongoose.connection.db;

  const files = readdirSync(backupPath).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  let allPassed = true;

  for (const file of files) {
    const collectionName = file.replace(".json", "");
    const expected = manifest.collections[collectionName];
    const data = JSON.parse(readFileSync(path.join(backupPath, file), "utf-8"));

    await db.collection(collectionName).deleteMany({});
    if (data.length > 0) {
      await db.collection(collectionName).insertMany(data);
    }

    const actual = await db.collection(collectionName).countDocuments();
    const ok = expected && actual === expected.count;
    if (!ok) allPassed = false;
    console.log(`  ${ok ? "✅" : "❌"} ${collectionName.padEnd(24)} backup: ${expected?.count ?? "?"}  restored: ${actual}  ${ok ? "MATCH" : "MISMATCH!"}`);
  }

  const totalExpected = Object.values(manifest.collections).reduce((s, c) => s + c.count, 0);
  let totalActual = 0;
  for (const file of files) {
    totalActual += await db.collection(file.replace(".json", "")).countDocuments();
  }

  console.log("------------------------------------------");
  console.log(`  TOTAL backup: ${totalExpected}   restored: ${totalActual}   ${totalExpected === totalActual ? "MATCH ✅" : "MISMATCH ❌"}`);
  console.log("------------------------------------------");

  console.log("Cleaning up test database...");
  await db.dropDatabase();
  console.log(`  🧹 ${TEST_DB_NAME} dropped`);

  console.log("\n==========================================");
  console.log(allPassed && totalExpected === totalActual
    ? "✅ RESTORE TEST PASSED — backup 100% valid, Atlas ma restore karva safe che"
    : "❌ RESTORE TEST FAILED — a backup vapro nahi, phari backup lo");
  console.log("==========================================");

  await mongoose.connection.close();
  process.exit(allPassed && totalExpected === totalActual ? 0 : 1);
};

verify().catch((e) => {
  console.error("❌ Restore test failed:", e.message);
  process.exit(1);
});
