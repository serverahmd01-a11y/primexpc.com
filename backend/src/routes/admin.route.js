import { Router } from "express";
import {
  createProduct,
  getAllCustomers,
  getAllOrders,
  getOrderById,
  getAllProducts,
  getDashboardStats,
  updateOrderStatus,
  updateProduct,
  deleteProduct,
  getCustomerDetail,
  toggleAdvancePaid,
  toggleBalancePaid,
  settleOrder,
  updateOrderTracking,
  getMissedOrders,
  createMissedOrder,
  updateProductStock,
} from "../controllers/admin.controller.js";
import { updateCustomer, createCustomer, getOrderStats } from "../controllers/admin.controller.js";
import { adminOnly, protectRoute, staffOnly, orderActionsOnly } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import { User } from "../models/user.model.js";

const router = Router();

router.use(protectRoute, staffOnly);

router.post("/products", adminOnly, upload.array("images", 5), createProduct);
router.get("/products", getAllProducts);
router.put("/products/:id", adminOnly, upload.array("images", 5), updateProduct);
router.patch("/products/:id/stock", adminOnly, updateProductStock);
router.delete("/products/:id", adminOnly, deleteProduct);

router.get("/orders", getAllOrders);
router.get("/orders/:orderId", getOrderById);
router.patch("/orders/:orderId/status", orderActionsOnly, updateOrderStatus);
router.patch("/orders/:orderId/advance", adminOnly, toggleAdvancePaid);
router.patch("/orders/:orderId/balance", orderActionsOnly, toggleBalancePaid);
router.patch("/orders/:orderId/settle", orderActionsOnly, settleOrder);
router.patch("/orders/:orderId/tracking", orderActionsOnly, updateOrderTracking);

router.get("/missed-orders", getMissedOrders);
router.post("/missed-orders", adminOnly, createMissedOrder);

router.get("/customers", adminOnly, getAllCustomers);
router.get("/customers/:customerId", adminOnly, getCustomerDetail);
router.patch("/customers/:customerId", adminOnly, updateCustomer);
router.post("/customers", adminOnly, createCustomer);

router.get("/stats", getDashboardStats);
router.get("/order-stats", getOrderStats);

router.patch("/users/:userId/role", adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!["user", "admin", "ca", "shipping"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (userId === String(req.user._id) && role !== "admin") {
      return res.status(400).json({ error: "You cannot demote yourself" });
    }
    if (target.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot demote the last admin" });
      }
    }
    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    res.json({ message: "Role updated", user: user.toSafeObject() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
