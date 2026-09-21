import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

const JWT_OPTIONS = { algorithms: ["HS256"] };

export const protectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - no token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET, JWT_OPTIONS);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Unauthorized - invalid token" });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, ENV.JWT_SECRET, JWT_OPTIONS);
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }

    if (!req.user) {
      req.guestId = req.headers["x-guest-id"] || "";
    }

    next();
  } catch {
    req.guestId = req.headers["x-guest-id"] || "";
    next();
  }
};

export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - user not found" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - admin access only" });
  }
  next();
};

export const staffOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - user not found" });
  }
  if (!["admin", "ca", "shipping"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden - staff access only" });
  }
  next();
};

export const orderActionsOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - user not found" });
  }
  if (!["admin", "shipping"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export const refreshAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, ENV.JWT_SECRET, { ...JWT_OPTIONS, ignoreExpiration: true });
      const expMs = (decoded.exp || 0) * 1000;
      if (!decoded.exp || Date.now() - expMs > 30 * 24 * 60 * 60 * 1000) {
        return res.status(401).json({ message: "Unauthorized - session too old, please login again" });
      }
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized - valid session required" });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized - invalid token" });
  }
};
