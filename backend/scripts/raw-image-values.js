import mongoose from "mongoose";

const uri =
  process.env.DB_URL ||
  "mongodb+srv://serverahmd01_db_user:aVCn6g12FC79R18U@cluster0.uh1vs2c.mongodb.net/primexpc";

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const products = await db.collection("products").find({}).limit(3).toArray();
for (const p of products) {
  console.log("Product:", p.name);
  console.log("  images  :", JSON.stringify(p.images));
  console.log("  video   :", JSON.stringify(p.video));
  console.log("  image   :", JSON.stringify(p.image));
}
const cats = await db.collection("categories").find({ image: { $nin: ["", null] } }).limit(3).toArray();
for (const c of cats) {
  console.log("Category:", c.name, "-> image:", JSON.stringify(c.image));
}
const settings = await db.collection("settings").find({ key: { $in: ["banner_images", "store_logo", "logo"] } }).toArray();
for (const s of settings) console.log("Setting:", s.key, "->", JSON.stringify(s.value).slice(0, 200));

await mongoose.connection.close();
process.exit(0);
