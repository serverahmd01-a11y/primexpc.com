import { Router } from "express";
import { getProductById, getProductsByIds } from "../controllers/product.controller.js";
import { Product } from "../models/product.model.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/public/featured", async (req, res) => {
  try {
    const featured = await Product.find({ featured: true, stock: { $gt: 0 } }).sort({ createdAt: -1 }).limit(8);
    res.status(200).json(featured);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

router.get("/cart-sync", getProductsByIds);
router.get("/:id", getProductById);

export default router;
