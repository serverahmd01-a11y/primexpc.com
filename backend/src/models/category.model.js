import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  description: { type: String, default: "" },
  image: { type: String, default: "" },
  condition: { type: String, enum: ["new", "refurbished"], default: "new" },
}, { timestamps: true });

categorySchema.index({ name: 1, parent: 1, condition: 1 }, { unique: true });

export const Category = mongoose.model("Category", categorySchema);
