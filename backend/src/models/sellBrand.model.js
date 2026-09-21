import mongoose from "mongoose";

const sellBrandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "SellCategory", required: true },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

sellBrandSchema.index({ name: 1, category: 1 }, { unique: true });

export const SellBrand = mongoose.model("SellBrand", sellBrandSchema);
