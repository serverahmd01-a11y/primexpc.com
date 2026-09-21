import { Router } from "express";
import { register, login, getMe, refresh, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { protectRoute, refreshAuth } from "../middleware/auth.middleware.js";
import { authLimiter, passwordResetLimiter } from "../middleware/security.middleware.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", protectRoute, getMe);
router.get("/refresh", refreshAuth, refresh);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPassword);

export default router;
