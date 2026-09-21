import { Product } from "../models/product.model.js";
import mongoose from "mongoose";

export async function getProductsByIds(req, res) {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => mongoose.isValidObjectId(s));
    if (ids.length === 0) return res.json({ products: [] });
    const products = await Product.find({ _id: { $in: ids } });
    res.json({ products });
  } catch (error) {
    console.error("Error fetching products by ids:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
