import { Router } from "express";
import {
  shipOrder,
  trackByAWB,
  generateLabelForOrder,
  cancelOrderShipment,
  adminListShiprocketOrders,
} from "../controllers/shiprocket.controller.js";
import { protectRoute, staffOnly } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute, staffOnly);

router.post("/ship/:orderId", shipOrder);
router.get("/track/:orderId", trackByAWB);
router.get("/label/:orderId", generateLabelForOrder);
router.post("/cancel/:orderId", cancelOrderShipment);
router.get("/orders", adminListShiprocketOrders);

export default router;
