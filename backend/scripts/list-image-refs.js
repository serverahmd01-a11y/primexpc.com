import mongoose from "mongoose";

const uri =
  process.env.DB_URL ||
  "mongodb+srv://serverahmd01_db_user:aVCn6g12FC79R18U@cluster0.uh1vs2c.mongodb.net/primexpc";

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
  const docs = await db.collection(name).find({}).toArray();
  docs.forEach(scan);
}

const list = [...refs].sort();
console.log("TOTAL image refs in DB:", list.length);
console.log(list.join("\n"));

await mongoose.connection.close();
process.exit(0);
