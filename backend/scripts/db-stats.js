import mongoose from "mongoose";
import dotenv from "dotenv";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";

const run = async () => {
  await mongoose.connect(DB_URL);
  const db = mongoose.connection.db;

  const lines = [];
  const log = (s) => {
    console.log(s);
    lines.push(s);
  };

  const stats = await db.stats();
  log("==========================================");
  log(`DATABASE: ${stats.db}`);
  log(`DB_URL   : ${DB_URL.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`);
  log("==========================================");
  log(`Total data size : ${(stats.dataSize / 1024 / 1024).toFixed(3)} MB`);
  log(`Storage size    : ${(stats.storageSize / 1024 / 1024).toFixed(3)} MB`);
  log(`Total documents : ${stats.objects}`);
  log(`Indexes size    : ${(stats.indexSize / 1024 / 1024).toFixed(3)} MB`);
  log("==========================================");
  log("COLLECTION-WISE BREAKDOWN:");
  log("------------------------------------------");

  const collections = await db.listCollections().toArray();
  let totalDocs = 0;
  for (const { name } of collections) {
    const cStats = await db.command({ collStats: name });
    log(
      `${name.padEnd(24)} docs: ${String(cStats.count).padStart(8)}  size: ${(cStats.size / 1024).toFixed(1).padStart(10)} KB`
    );
    totalDocs += cStats.count;
  }
  log("------------------------------------------");
  log(`Total docs across all collections: ${totalDocs}`);
  log("==========================================");
  log(`\nAtlas M0 free limit: 512 MB -> used: ${(stats.storageSize / 1024 / 1024).toFixed(3)} MB`);
  log(`=> ${((stats.storageSize / (512 * 1024 * 1024)) * 100).toFixed(3)}% of free tier used`);

  const reportPath = path.join(__dirname, "..", "db-stats-report.txt");
  writeFileSync(reportPath, lines.join("\n"), "utf-8");
  log(`\nReport saved to: ${reportPath}`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
