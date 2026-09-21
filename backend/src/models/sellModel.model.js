import mongoose from "mongoose";

const sellModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "SellBrand", required: true },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

sellModelSchema.index({ name: 1, brand: 1 }, { unique: true });

export const SellModel = mongoose.model("SellModel", sellModelSchema);
