import { Counter } from "../models/counter.model.js";

export async function generateOrderNumber(OrderModel) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const counter = await Counter.findOneAndUpdate(
      { _id: "order" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const number = counter?.seq ?? 1;

    const exists = await OrderModel.findOne({ orderNumber: number }).select("_id").lean();
    if (!exists) return number;
  }
  throw new Error("Could not generate unique order number");
}

export function formatOrderNumber(number) {
  if (!number) return "";
  return String(number).padStart(4, "0");
}