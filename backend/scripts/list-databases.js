import mongoose from "mongoose";

const SERVER_URL = process.env.MONGO_SERVER_URL || "mongodb://localhost:27017";

const run = async () => {
  await mongoose.connect(SERVER_URL);
  const admin = mongoose.connection.db.admin();

  const { databases } = await admin.listDatabases();
  const skip = new Set(["admin", "local", "config"]);

  console.log("==========================================");
  console.log(`MongoDB SERVER: ${SERVER_URL}`);
  console.log("==========================================");

  for (const info of databases) {
    if (skip.has(info.name)) continue;
    const db = mongoose.connection.client.db(info.name);
    const collections = await db.listCollections().toArray();
    let docs = 0;
    for (const { name } of collections) {
      const c = await db.command({ collStats: name });
      docs += c.count;
    }
    console.log(
      `DB: ${info.name.padEnd(20)} collections: ${String(collections.length).padStart(3)}  docs: ${String(docs).padStart(8)}  size: ${(info.sizeOnDisk / 1024).toFixed(1)} KB`
    );
  }

  console.log("==========================================");

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
