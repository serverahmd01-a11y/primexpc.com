import mongoose from "mongoose";
import { ENV } from "../src/config/env.js";

const API_ORIGIN = process.env.API_ORIGIN || "https://api.primexpc.com";
const DRY_RUN = process.env.DRY_RUN === "1";

const conn = await mongoose.connect(ENV.DB_URL);
const db = conn.connection.db;
const products = db.collection("products");

const all = await products.find({}, { projection: { name: 1, images: 1 } }).toArray();
console.log(`Total products: ${all.length}`);

let updated = 0;
let removed = 0;
const problems = [];

for (const p of all) {
  const imgs = p.images || [];
  if (imgs.length === 0) continue;

  const good = [];
  for (const img of imgs) {
    const clean = String(img).replace(/^\/?uploads\//, "");
    let code = 0;
    try {
      const res = await fetch(`${API_ORIGIN}/uploads/${clean}`, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      code = res.status;
    } catch { code = 0; }
    if (code === 200) {
      good.push(img);
    } else {
      removed++;
      console.log(`REMOVE [HTTP ${code}] ${p.name} -> ${img}`);
    }
  }

  if (good.length !== imgs.length) {
    if (DRY_RUN) {
      console.log(`DRY RUN: would update ${p._id} ${p.name}: ${imgs.length} -> ${good.length} images`);
      continue;
    }
    await products.updateOne({ _id: p._id }, { $set: { images: good } });
    updated++;
    if (good.length === 0) {
      problems.push(`ALL IMAGES BROKEN: ${p.name} (${p._id})`);
    }
  }
}

console.log(`\nUpdated products: ${updated}`);
console.log(`Removed broken images: ${removed}`);
if (problems.length) {
  console.log("\nProducts left with NO images:");
  problems.forEach((x) => console.log("- " + x));
}

await conn.disconnect();