import { Router } from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import {
  updateLeadStatus, offerPrice, addAdminNote,
  schedulePickup, trackLeadPickup, getPickupLabel,
  getDashboardStats,
  adminGetSellProducts, adminCreateSellProduct,
  adminUpdateSellProduct, adminDeleteSellProduct,
  getLeadById, getAllLeads,
  adminGetCategories, adminCreateCategory,
  adminUpdateCategory, adminDeleteCategory,
  adminGetBrands, adminCreateBrand,
  adminUpdateBrand, adminDeleteBrand,
  adminGetModels, adminCreateModel,
  adminUpdateModel, adminDeleteModel,
} from "../controllers/sell.controller.js";

const router = Router();

router.use(protectRoute, adminOnly);

router.get("/leads", getAllLeads);
router.get("/leads/:id", getLeadById);
router.patch("/leads/:id/status", updateLeadStatus);
router.post("/leads/:id/offer-price", offerPrice);
router.post("/leads/:id/notes", addAdminNote);
router.post("/leads/:id/schedule-pickup", schedulePickup);
router.get("/leads/:id/track", trackLeadPickup);
router.get("/leads/:id/label", getPickupLabel);

router.get("/products", adminGetSellProducts);
router.post("/products", upload.single("image"), adminCreateSellProduct);
router.put("/products/:id", upload.single("image"), adminUpdateSellProduct);
router.delete("/products/:id", adminDeleteSellProduct);

router.get("/categories", adminGetCategories);
router.post("/categories", upload.single("image"), adminCreateCategory);
router.put("/categories/:id", upload.single("image"), adminUpdateCategory);
router.delete("/categories/:id", adminDeleteCategory);

router.get("/brands", adminGetBrands);
router.post("/brands", adminCreateBrand);
router.put("/brands/:id", adminUpdateBrand);
router.delete("/brands/:id", adminDeleteBrand);

router.get("/models", adminGetModels);
router.post("/models", adminCreateModel);
router.put("/models/:id", adminUpdateModel);
router.delete("/models/:id", adminDeleteModel);

router.get("/stats", getDashboardStats);

export default router;
