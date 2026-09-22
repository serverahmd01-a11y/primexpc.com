import mongoose from "mongoose";

const uri =
  process.env.DB_URL ||
  "mongodb+srv://serverahmd01_db_user:aVCn6g12FC79R18U@cluster0.uh1vs2c.mongodb.net/primexpc";
const base = process.env.SITE_URL || "https://darkorange-yak-723805.hostingersite.com";

const refs = new Set();
const scan = (v) => {
  if (typeof v === "string") {
    const m = v.match(/\/uploads\/[^"'\s,\]]+/g);
    if (m) m.forEach((x) => refs.add(x.replace("/uploads/", "")));
  } else if (Array.isArray(v)) v.forEach(scan);
  else if (v && typeof v === "object") Object.values(v).forEach(scan);
};

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
for (const name of ["products", "categories", "settings", "pages", "sellproducts", "sellleads"]) {
  (await db.collection(name).find({}).toArray()).forEach(scan);
}
await mongoose.connection.close();

const list = [...refs].sort();
const missing = [];
const present = [];
const CONCURRENCY = 12;

async function check(file) {
  try {
    const res = await fetch(`${base}/uploads/${file}`, { method: "HEAD" });
    if (res.ok) present.push(file);
    else missing.push(file);
  } catch {
    missing.push(file);
  }
}

let i = 0;
async function worker() {
  while (i < list.length) {
    const idx = i++;
    await check(list[idx]);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("Site           :", base);
console.log("DB references  :", list.length);
console.log("Present (live) :", present.length);
console.log("MISSING (live) :", missing.length);
console.log("\n--- MISSING files (upload these) ---");
console.log(missing.join("\n"));
process.exit(0);
