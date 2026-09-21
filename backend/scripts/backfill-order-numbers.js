import mongoose from "mongoose";
import { Order } from "../src/models/order.model.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";

const backfill = async () => {
  try {
    await mongoose.connect(DB_URL);

    const ordersWithoutNumber = await Order.find({ orderNumber: { $exists: false } }).sort({ createdAt: 1 });

    let nextNumber = 0;
    const highest = await Order.findOne({ orderNumber: { $exists: true } })
      .sort({ orderNumber: -1 })
      .select("orderNumber");
    if (highest?.orderNumber) nextNumber = highest.orderNumber;

    for (const order of ordersWithoutNumber) {
      nextNumber += 1;
      const padded = String(nextNumber).padStart(4, "0");
      await Order.updateOne({ _id: order._id }, { $set: { orderNumber: nextNumber } });
      console.log(`   Assigned #${padded} → ${order._id}`);
    }

    console.log(`\n✅ Backfill complete: ${ordersWithoutNumber.length} orders numbered.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err.message);
    process.exit(1);
  }
};

backfill();