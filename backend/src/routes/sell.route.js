import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import {
  sendOTP, verifyOTP, uploadSellFile, submitLead,
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

router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/upload", uploadWrapper, uploadSellFile);
router.post("/submit", submitLead);

router.get("/leads/me", protectRoute, getMyLeadsByUser);
router.get("/leads", protectRoute, getMyLeads);
router.get("/leads/:id", protectRoute, getLeadById);
router.post("/leads/:id/respond", protectRoute, customerRespond);

export default router;
