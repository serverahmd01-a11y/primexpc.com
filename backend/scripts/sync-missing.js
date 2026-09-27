import mongoose from "mongoose";

// ============================================================================
// Sync MISSING documents: LOCAL MongoDB -> ONLINE (Atlas) MongoDB
//
// For every collection in the LOCAL database, this finds documents whose _id
// does NOT exist in the ONLINE database and inserts them.
// It NEVER deletes or overwrites anything on the online side.
//
// Usage (PowerShell):
//   # 1) Preview what is missing (no writes)
//   $env:ONLINE_DB_URL="mongodb+srv://user:pass@cluster.mongodb.net/primexpc"
//   node scripts/sync-missing.js
//
//   # 2) Actually insert the missing documents
//   node scripts/sync-missing.js --apply
//
// Optional:
//   $env:LOCAL_DB_URL="mongodb://localhost:27017/primexpc"
// ============================================================================

const LOCAL_URL = process.env.LOCAL_DB_URL || "mongodb://localhost:27017/primexpc";
const ONLINE_URL = process.env.ONLINE_DB_URL;
const APPLY = process.argv.includes("--apply");

if (!ONLINE_URL) {
  console.error("ERROR: ONLINE_DB_URL environment variable is required.");
  console.error('  PowerShell: $env:ONLINE_DB_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/primexpc"');
  console.error("  Then run:   node scripts/sync-missing.js [--apply]");
  process.exit(1);
}

const mask = (u) => u.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

const run = async () => {
  console.log("=====================================================");
  console.log("  SYNC MISSING DOCS  (LOCAL -> ONLINE)");
  console.log("=====================================================");
  console.log("LOCAL  :", mask(LOCAL_URL));
  console.log("ONLINE :", mask(ONLINE_URL));
  console.log("MODE   :", APPLY ? "APPLY (will insert)" : "DRY RUN (preview only)");
  console.log("-----------------------------------------------------");

  const local = await mongoose.createConnection(LOCAL_URL, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const online = await mongoose.createConnection(ONLINE_URL, { serverSelectionTimeoutMS: 10000 }).asPromise();

  const localCols = await local.db.listCollections().toArray();
  const onlineCols = new Set((await online.db.listCollections().toArray()).map((c) => c.name));

  let grandTotalMissing = 0;
  let grandTotalInserted = 0;
  const summary = [];

  for (const { name } of localCols) {
    const localDocs = await local.db.collection(name).find({}).toArray();
    if (localDocs.length === 0) {
      summary.push({ name, local: 0, online: 0, missing: 0, inserted: 0 });
      continue;
    }

    const onlineIds = new Set(
      (await online.db.collection(name).find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id))
    );
    const missing = localDocs.filter((d) => !onlineIds.has(String(d._id)));

    let inserted = 0;
    if (APPLY && missing.length > 0) {
      try {
        const res = await online.db.collection(name).insertMany(missing, { ordered: false });
        inserted = res.insertedCount;
      } catch (err) {
        inserted = err?.result?.insertedCount ?? 0;
        const failed = missing.length - inserted;
        if (failed > 0) console.log(`  ! ${name}: ${failed} doc(s) failed (likely duplicate key)`);
      }
    }

    grandTotalMissing += missing.length;
    grandTotalInserted += inserted;
    summary.push({ name, local: localDocs.length, online: onlineIds.size, missing: missing.length, inserted });
  }

  console.log("\nCollection            local   online   missing   inserted");
  console.log("--------------------------------------------------------");
  for (const s of summary.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      `  ${s.name.padEnd(20)} ${String(s.local).padStart(6)} ${String(s.online).padStart(8)} ${String(s.missing).padStart(9)} ${String(s.inserted).padStart(10)}`
    );
  }
  console.log("--------------------------------------------------------");
  console.log(`  TOTAL MISSING: ${grandTotalMissing}` + (APPLY ? `   INSERTED: ${grandTotalInserted}` : ""));
  console.log("=====================================================");
  console.log(APPLY ? "DONE - missing documents inserted into ONLINE." : "DRY RUN complete. Re-run with --apply to insert.");
  console.log("=====================================================");

  await local.close();
  await online.close();
  process.exit(0);
};

run().catch((e) => {
  console.error("Sync failed:", e.message);
  process.exit(1);
});
