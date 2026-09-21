import { Router } from "express";
import { optionalAuth, protectRoute } from "../middleware/auth.middleware.js";
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartItem,
  mergeCart,
} from "../controllers/cart.controller.js";

const router = Router();

router.get("/", optionalAuth, getCart);
router.post("/", optionalAuth, addToCart);
router.put("/:productId", optionalAuth, updateCartItem);
router.delete("/:productId", optionalAuth, removeFromCart);
router.delete("/", optionalAuth, clearCart);
router.post("/merge", protectRoute, mergeCart);

export default router;
