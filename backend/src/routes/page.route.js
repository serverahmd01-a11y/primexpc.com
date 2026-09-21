import { Router } from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { getPages, getPublicPages, getPageBySlug, createPage, updatePage, deletePage, togglePageActive } from "../controllers/page.controller.js";

const router = Router();

router.get("/public", getPublicPages);
router.get("/slug/:slug", getPageBySlug);
router.get("/", protectRoute, adminOnly, getPages);
router.post("/", protectRoute, adminOnly, createPage);
router.put("/:id", protectRoute, adminOnly, updatePage);
router.delete("/:id", protectRoute, adminOnly, deletePage);
router.patch("/:id/toggle", protectRoute, adminOnly, togglePageActive);

export default router;
