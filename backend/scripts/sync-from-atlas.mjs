// One-way replica sync: MongoDB Atlas -> local MongoDB.
// READ-ONLY on the source (Atlas): nothing there is ever written or deleted.
// Locally it MERGES by _id — local-only documents are kept, and when the same
// _id exists the source (production) version wins.
//
// Usage:
//   ATLAS_URL="mongodb+srv://user:pass@cluster/primexpc" node scripts/sync-from-atlas.mjs
// Optional:
//   LOCAL_URL="mongodb://localhost:27017/primexpc" (default shown above)
//   DROP_LOCAL=1  → wipe each local collection first for an exact replica instead of a merge

import mongoose from "mongoose";

const ATLAS_URL = process.env.ATLAS_URL;
const LOCAL_URL = process.env.LOCAL_URL || "mongodb://localhost:27017/primexpc";
const DB_NAME = process.env.DB_NAME || new URL(ATLAS_URL).pathname.replace("/", "") || "primexpc";

if (!ATLAS_URL) {
  console.error("ATLAS_URL env var is required");
  process.exit(1);
}

const log = (emoji, msg) => console.log(`${emoji}  ${msg}`);

const run = async () => {
  log("🔌", `Connecting to source (Atlas) and local...`);
  const src = await mongoose.createConnection(ATLAS_URL, { dbName: DB_NAME }).asPromise();
  const dst = await mongoose.createConnection(LOCAL_URL).asPromise();
  log("✅", "Both connected.");

  const collections = await src.db.listCollections().toArray();
  let totalAdded = 0;
  let totalUpdated = 0;

  for (const { name } of collections) {
    const docs = await src.db.collection(name).find({}).toArray();
    if (docs.length === 0) {
      log("⏭️ ", `${name}: 0 documents on source, skipped`);
      continue;
    }

    if (process.env.DROP_LOCAL === "1") {
      await dst.db.collection(name).deleteMany({});
    }

    // Upsert in chunks — _id match → source wins; no match → inserted.
    let added = 0;
    let updated = 0;
    for (let i = 0; i < docs.length; i += 500) {
      const chunk = docs.slice(i, i + 500);
      const ops = chunk.map((doc) => ({
        updateOne: { filter: { _id: doc._id }, update: { $set: doc }, upsert: true },
      }));
      const result = await dst.db.collection(name).bulkWrite(ops, { ordered: false });
      added += result.upsertedCount || 0;
      updated += result.modifiedCount + (result.matchedCount - result.modifiedCount) * 0;
    }
    totalAdded += added;
    totalUpdated += updated;
    log("📦", `${name}: ${docs.length} docs from source — ${added} new, ${docs.length - added} overwritten/unchanged`);
  }

  log("🎯", `Done! ${collections.length} collections · ${totalAdded} added · rest matched from source.`);

  await src.close();
  await dst.close();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err.message);
  if (String(err.message).includes("ENOTFOUND") || String(err.message).includes("getaddrinfo")) {
    console.error("   → Check your internet connection / Atlas cluster URL.");
  }
  if (String(err.message).includes("not allowed") || String(err.message).includes("whitelist") || String(err.message).includes("authentication")) {
    console.error("   → Your IP is not in Atlas Network Access, or the user/password is wrong.");
  }
  process.exit(1);
});
