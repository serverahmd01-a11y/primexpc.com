import mongoose from "mongoose";

const sellCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  icon: { type: String, default: "Box" },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export const SellCategory = mongoose.model("SellCategory", sellCategorySchema);
