import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";

const migrate = async () => {
  try {
    await mongoose.connect(DB_URL);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const collection = db.collection("categories");

    // 1. List all current indexes
    console.log("📋 Current indexes:");
    const indexes = await collection.indexes();
    indexes.forEach((i) => console.log(`   - ${i.name}: ${JSON.stringify(i.key)} unique=${i.unique || false}`));

    // 2. Drop the rogue unique indexes if they exist
    const dropIndexes = ["name_1", "name_1_parent_1"];
    for (const idxName of dropIndexes) {
      const idx = indexes.find((i) => i.name === idxName && i.unique);
      if (idx) {
        await collection.dropIndex(idxName);
        console.log(`🗑️  Dropped rogue '${idxName}' unique index`);
      }
    }
    const remaining = indexes.filter((i) => dropIndexes.includes(i.name) && i.unique);
    if (remaining.length === 0 && !indexes.find((i) => i.name === "name_1")) {
      console.log("✅ No rogue indexes found - already clean");
    }

    // 3. Find all categories with condition "both"
    const bothCategories = await collection.find({ condition: "both" }).toArray();
    console.log(`\n🔍 Found ${bothCategories.length} categories with condition "both"`);

    if (bothCategories.length > 0) {
      // 4. Get all category names that exist with condition "new"
      const existingNewNames = new Set(
        (await collection.find({ condition: "new" }, { projection: { name: 1 } }).toArray())
          .map((c) => c.name)
      );

      let migrated = 0;
      let skipped = 0;

      for (const cat of bothCategories) {
        if (existingNewNames.has(cat.name)) {
          // Same name already exists as "new" - skip to avoid conflict
          console.log(`   ⚠️  SKIP: "${cat.name}" already exists with condition "new" — deleting "both" version`);
          await collection.deleteOne({ _id: cat._id });
          skipped++;
        } else {
          // Migrate condition from "both" to "new"
          await collection.updateOne(
            { _id: cat._id },
            { $set: { condition: "new" } }
          );
          console.log(`   ✅ "${cat.name}" migrated: both → new`);
          migrated++;
        }
      }

      console.log(`\n📊 Result: ${migrated} migrated, ${skipped} skipped (deleted duplicate "both" versions)`);
    }

    // 5. Check for any categories with invalid conditions (not "new" or "refurbished")
    const invalid = await collection.find({
      condition: { $nin: ["new", "refurbished"] }
    }).toArray();

    if (invalid.length > 0) {
      console.log(`\n⚠️  ${invalid.length} categories with unrecognized condition — setting to "new":`);
      for (const cat of invalid) {
        await collection.updateOne({ _id: cat._id }, { $set: { condition: "new" } });
        console.log(`   ✅ "${cat.name}" condition: "${cat.condition}" → "new"`);
      }
    }

    // 6. Final summary
    const stats = await collection.aggregate([
      { $group: { _id: "$condition", count: { $sum: 1 } } }
    ]).toArray();

    console.log("\n📊 Final category counts by condition:");
    stats.forEach((s) => console.log(`   ${s._id || "(null)"}: ${s.count}`));

    const totalCats = await collection.countDocuments();
    console.log(`\n✅ Total categories: ${totalCats}`);
    console.log("✅ Migration complete — no categories deleted (except duplicate 'both' versions)\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
};

migrate();
