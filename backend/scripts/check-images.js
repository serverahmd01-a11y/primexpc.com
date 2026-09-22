import mongoose from "mongoose";
import { existsSync, readdirSync } from "fs";
import path from "path";

const uri =
  process.env.DB_URL ||
  "mongodb+srv://serverahmd01_db_user:aVCn6g12FC79R18U@cluster0.uh1vs2c.mongodb.net/primexpc";
const uploadsDir = process.argv[2] || path.join(process.cwd(), "uploads");

const refs = new Set();
const scan = (v) => {
  if (typeof v === "string") {
    const m = v.match(/\/uploads\/[^"'\s,\]]+/g);
    if (m) m.forEach((x) => refs.add(x.replace("/uploads/", "")));
  } else if (Array.isArray(v)) {
    v.forEach(scan);
  } else if (v && typeof v === "object") {
    Object.values(v).forEach(scan);
  }
};

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
for (const name of ["products", "categories", "settings", "pages", "sellproducts", "sellleads"]) {
  (await db.collection(name).find({}).toArray()).forEach(scan);
}
await mongoose.connection.close();

const local = new Set(existsSync(uploadsDir) ? readdirSync(uploadsDir) : []);
const present = [...refs].filter((r) => local.has(r));
const missing = [...refs].filter((r) => !local.has(r));

console.log("Uploads folder :", uploadsDir);
console.log("DB references  :", refs.size);
console.log("Local files    :", local.size);
console.log("Present        :", present.length);
console.log("MISSING        :", missing.length);
if (missing.length) {
  console.log("\n--- Missing files ---");
  console.log(missing.join("\n"));
}
process.exit(0);
