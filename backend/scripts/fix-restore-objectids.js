import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

await mongoose.connect("mongodb://localhost:27017/primexpc", { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;

const REF_FIELDS = {
  users: ["_id"],
  categories: ["_id"],
  products: ["_id", "category"],
  orders: ["_id", "user", "orderItems.product"],
  carts: ["_id", "user", "items.product"],
  reviews: ["_id", "user", "product"],
  sellmodels: ["_id", "brand"],
  sellbrands: ["_id", "category"],
  sellcategories: ["_id"],
  sellleads: ["_id", "user"],
  sellproducts: ["_id", "category", "brand", "model"],
};

const isOid = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);
const toOid = (v) => (isOid(v) ? new ObjectId(v) : v);

for (const [col, fields] of Object.entries(REF_FIELDS)) {
  const coll = db.collection(col);
  const all = await coll.find({}).toArray();
  let total = 0;
  let fixed = 0;
  for (const raw of all) {
    total++;
    const doc = structuredClone(raw);
    let changed = false;

    const walk = (node, path) => {
      for (const key of Object.keys(node || {})) {
        const curPath = path === "" ? key : `${path}.${key}`;
        const val = node[key];
        if (fields.includes(curPath) && isOid(val)) {
          node[key] = toOid(val);
          changed = true;
        } else if (Array.isArray(val)) {
          val.forEach((it, i) => walk(it, `${curPath}.${i}`));
        } else if (val && typeof val === "object") {
          walk(val, curPath);
        }
      }
    };
    walk(doc, "");

    if (!changed) continue;
    fixed++;

    const oldId = raw._id;
    await coll.deleteOne({ _id: oldId });

    if (fields.includes("_id")) {
      const { _id, ...rest } = doc;
      await coll.insertOne({ _id, ...rest });
    } else {
      delete doc._id;
      await coll.insertOne(doc);
    }
  }
  console.log(`  ${col}: ${total} docs, ${fixed} fixed`);
}

await mongoose.connection.close();
process.exit(0);