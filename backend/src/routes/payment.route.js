import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleWebhook,
  placeOrder,
} from "../controllers/payment.controller.js";

const router = Router();

router.post("/create-order", protectRoute, createRazorpayOrder);
router.post("/verify", protectRoute, verifyRazorpayPayment);
router.post("/place-order", protectRoute, placeOrder);

export default router;
