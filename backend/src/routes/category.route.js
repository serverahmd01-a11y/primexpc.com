import { Router } from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import { getCategories, createCategory, deleteCategory, updateCategory, seedDefaultCategories } from "../controllers/category.controller.js";

const router = Router();

router.get("/", getCategories);
router.post("/", protectRoute, adminOnly, upload.single("image"), createCategory);
router.put("/:id", protectRoute, adminOnly, upload.single("image"), updateCategory);
router.delete("/:id", protectRoute, adminOnly, deleteCategory);
router.post("/seed", protectRoute, adminOnly, seedDefaultCategories);

export default router;
