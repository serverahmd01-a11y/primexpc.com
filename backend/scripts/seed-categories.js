import mongoose from "mongoose";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";

const defaults = [
  { name: "Processor", subs: ["Intel", "AMD"] },
  { name: "GPU", subs: ["NVIDIA", "AMD"] },
  { name: "Motherboard", subs: ["Intel", "AMD"] },
  { name: "RAM", subs: ["DDR4", "DDR5"] },
  { name: "Storage", subs: ["SSD", "HDD", "NVMe"] },
  { name: "PSU", subs: ["Modular", "Non-Modular"] },
  { name: "CPU Cooler", subs: ["Air", "Liquid"] },
  { name: "Case", subs: ["Full Tower", "Mid Tower", "Mini"] },
  { name: "Monitor", subs: ["1080p", "1440p", "4K"] },
  { name: "Peripherals", subs: ["Keyboard", "Mouse", "Headset"] },
  { name: "Accessories", subs: ["Cable", "Thermal Paste", "Fan"] },
  { name: "Laptop", subs: ["Gaming", "Ultrabook", "Workstation"] },
];

const seed = async () => {
  await mongoose.connect(DB_URL);
  const db = mongoose.connection.db;
  const cc = db.collection("categories");

  await cc.deleteMany({});
  console.log("Cleared all categories");

  for (const cond of ["new", "refurbished"]) {
    let count = 0;
    for (const { name, subs } of defaults) {
      const parentCat = await cc.insertOne({ name, parent: null, condition: cond, description: "", image: "", createdAt: new Date(), updatedAt: new Date() });
      count++;
      for (const sub of subs) {
        await cc.insertOne({ name: sub, parent: parentCat.insertedId, condition: cond, description: "", image: "", createdAt: new Date(), updatedAt: new Date() });
        count++;
      }
    }
    console.log(`Seeded ${cond}: ${count} categories`);
  }

  const stats = await cc.aggregate([{ $group: { _id: "$condition", count: { $sum: 1 } } }]).toArray();
  console.log("\nFinal counts:");
  stats.forEach((s) => console.log(`  ${s._id}: ${s.count}`));

  const gpus = await cc.find({ name: "GPU" }).toArray();
  console.log(`\nGPU entries: ${gpus.length}`);
  gpus.forEach((g) => console.log(`  GPU | condition=${g.condition}`));

  await mongoose.connection.close();
  console.log("\nDone!");
};

seed();
