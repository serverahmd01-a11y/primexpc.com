import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    category: {
      type: String,
      required: true,
    },
    subCategory: {
      type: String,
      default: "",
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    video: {
      type: String,
      default: "",
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    salePrice: {
      type: Number,
      default: 0,
    },
    dealEndsAt: {
      type: Date,
      default: null,
    },
    gstRate: {
      type: Number,
      default: 18,
    },
    condition: {
      type: String,
      enum: ["new", "refurbished"],
      default: "new",
    },
    specifications: [
      {
        name: { type: String },
        value: { type: String },
      },
    ],
  },
  { timestamps: true }
);

productSchema.index({ category: 1, condition: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: "text" });

export const Product = mongoose.model("Product", productSchema);
