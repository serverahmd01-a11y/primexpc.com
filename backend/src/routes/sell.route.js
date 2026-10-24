import { Router } from "express";
import { protectRoute, optionalAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import {
  uploadSellFile, submitLead,
  getMyLeads, getMyLeadsByUser, getLeadById, customerRespond,
} from "../controllers/sell.controller.js";

const router = Router();

const uploadWrapper = (req, res, next) => {
  const mw = upload.array("files", 20);
  mw(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err.message);
      return res.status(400).json({ message: "Upload error: " + err.message });
    }
    next();
  });
};

router.post("/upload", uploadWrapper, uploadSellFile);
router.post("/submit", submitLead);

router.get("/leads/me", protectRoute, getMyLeadsByUser);
// optionalAuth: customers track their sell request by mobile without login —
// the controller authorizes per lead (staff / matching email / matching mobile).
router.get("/leads", optionalAuth, getMyLeads);
router.get("/leads/:id", optionalAuth, getLeadById);
router.post("/leads/:id/respond", optionalAuth, customerRespond);

export default router;
