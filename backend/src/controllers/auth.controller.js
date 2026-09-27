import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";
import { sendEmail } from "../config/email.js";

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, ENV.JWT_SECRET, { expiresIn: "7d" });
}

function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[<>"'&]/g, "").trim();
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const safeName = sanitize(name);
    const safeEmail = sanitize(email).toLowerCase();

    if (typeof safeName !== "string" || safeName.length < 2 || safeName.length > 50) {
      return res.status(400).json({ message: "Name must be between 2 and 50 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: safeEmail });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const role = ENV.BOOTSTRAP_ADMIN_EMAIL === safeEmail && ENV.BOOTSTRAP_ADMIN_PASSWORD === password
      ? "admin"
      : "user";

    let user;
    try {
      user = await User.create({
        name: safeName,
        email: safeEmail,
        password: hashedPassword,
        role,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: "Email already registered" });
      }
      throw err;
    }

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      user: user.toSafeObject(),
      token,
      isFirstUser: false,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const safeEmail = sanitize(email).toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = await User.findOne({ email: safeEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      user: user.toSafeObject(),
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMe(req, res) {
  try {
    res.status(200).json({ user: req.user.toSafeObject() });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function refresh(req, res) {
  try {
    const token = generateToken(req.user._id, req.user.role);
    res.status(200).json({
      user: req.user.toSafeObject(),
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(200).json({ message: "If that email exists, a reset link has been sent" });
    }

    const plainToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(plainToken, 10);

    user.resetToken = hashedToken;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${ENV.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${plainToken}&email=${encodeURIComponent(user.email)}`;

    await sendEmail({
      to: user.email,
      subject: "Reset Your Password - PrimeX PC",
      html: `
        <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#121212;color:#e0e0e0;border-radius:12px;overflow:hidden;border:1px solid #333">
          <div style="background:#10b981;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">PrimeX PC</h1></div>
          <div style="padding:32px">
            <h2 style="color:#fff;margin:0 0 16px">Password Reset</h2>
            <p style="color:#a0a0a0;line-height:1.6">You requested a password reset for your account. Click the button below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Reset Password</a>
            <p style="color:#666;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    res.status(200).json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
      return res.status(400).json({ message: "Token, email, and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetToken: { $ne: null },
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const isMatch = await bcrypt.compare(token, user.resetToken);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully. You can now login." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
