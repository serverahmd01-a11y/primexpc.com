import mongoose from "mongoose";
import { ENV } from "../src/config/env.js";

const migrate = async () => {
  try {
    await mongoose.connect(ENV.DB_URL);
    console.log("Connected to MongoDB");

    const collection = mongoose.connection.db.collection("categories");
    const indexes = await collection.indexes();
    console.log("Existing indexes:", indexes.map((i) => i.name));

    // Drop old unique index that only had (name, parent) without condition
    const oldIndexes = indexes.filter(
      (i) => i.name === "name_1_parent_1" && i.unique
    );
    for (const idx of oldIndexes) {
      await collection.dropIndex(idx.name);
      console.log(`Dropped old index: ${idx.name}`);
    }

    // Create new unique index including condition
    const newIdxExists = indexes.some((i) => i.name === "name_1_parent_1_condition_1");
    if (!newIdxExists) {
      await collection.createIndex(
        { name: 1, parent: 1, condition: 1 },
        { unique: true }
      );
      console.log("Created new unique index: name_1_parent_1_condition_1");
    } else {
      console.log("New index already exists");
    }

    console.log("Migration complete");
  } catch (error) {
    console.error("Migration error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

migrate();
