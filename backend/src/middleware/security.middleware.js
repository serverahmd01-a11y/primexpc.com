import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitizePackage from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";
import { ENV } from "../config/env.js";

const isProduction = ENV.NODE_ENV === "production";

// express-mongo-sanitize middleware touches req.query which is getter-only in Express 5 —
// wrap it so it still cleans body/params/query on Express 5 without throwing.
export const mongoSanitize = (options = {}) => {
  const sanitize = mongoSanitizePackage.sanitize;
  return (req, res, next) => {
    ["body", "params", "query"].forEach((key) => {
      if (req[key] && typeof req[key] === "object") {
        const cleaned = sanitize(req[key], options);
        try {
          req[key] = cleaned;
        } catch {
          try {
            Object.defineProperty(req, key, {
              value: cleaned,
              configurable: true,
              enumerable: true,
              writable: true,
            });
          } catch { /* leave unchanged */ }
        }
      }
    });
    next();
  };
};

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://apis.google.com", "https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.primexpc.com", "https://primexpc.com", "https://*.google-analytics.com", "https://*.googletagmanager.com"],
      connectSrc: ["'self'", "https://api.primexpc.com", "https://*.razorpay.com", "https://lumberjack.razorpay.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://*.razorpay.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      formAction: ["'self'", "https://api.razorpay.com"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: "deny" },
  dnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  hidePoweredBy: true,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
  skipSuccessfulRequests: true,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests, please try again later." },
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

export { xss, hpp };
