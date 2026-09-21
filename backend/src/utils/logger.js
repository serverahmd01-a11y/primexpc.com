import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "..", "..", "logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const VALID_LOG_TYPES = new Set(["order", "payment", "auth", "error", "admin"]);

function getLogFile(type) {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${type}_${today}.log`);
}

function formatLog(level, message, data) {
  const ts = new Date().toISOString();
  let line = `[${ts}] [${level}] ${message}`;
  if (data !== undefined) {
    if (typeof data === "string") {
      line += ` | ${data}`;
    } else {
      line += ` | ${JSON.stringify(data)}`;
    }
  }
  return line + "\n";
}

function writeLog(type, level, message, data) {
  try {
    const file = getLogFile(type);
    const line = formatLog(level, message, data);
    fs.appendFile(file, line, (err) => {
      if (err) console.error("Logger write error:", err.message);
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[LOG:${level}] ${message}`, data || "");
    }
  } catch (e) {
    console.error("Logger write error:", e.message);
  }
}

export const logger = {
  order: (level, message, data) => writeLog("order", level, message, data),
  payment: (level, message, data) => writeLog("payment", level, message, data),
  auth: (level, message, data) => writeLog("auth", level, message, data),
  error: (level, message, data) => writeLog("error", level, message, data),
  admin: (level, message, data) => writeLog("admin", level, message, data),
};

export function getLogs(type, date) {
  if (!VALID_LOG_TYPES.has(type)) return [];
  const day = date || new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${type}_${day}.log`);
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.resolve(LOG_DIR))) return [];
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\[(.+?)\] \[(.+?)\] (.+)$/);
        if (match) {
          return { timestamp: match[1], level: match[2], message: match[3] };
        }
        return { timestamp: "", level: "UNKNOWN", message: line };
      });
  } catch (e) {
    return [];
  }
}

export function getAvailableLogFiles() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const groups = {};
    for (const f of files) {
      const match = f.match(/^(\w+)_(\d{4}-\d{2}-\d{2})\.log$/);
      if (match) {
        const type = match[1];
        const date = match[2];
        if (!VALID_LOG_TYPES.has(type)) continue;
        if (!groups[type]) groups[type] = [];
        groups[type].push({ date, file: f });
      }
    }
    for (const type of Object.keys(groups)) {
      groups[type].sort((a, b) => b.date.localeCompare(a.date));
    }
    return groups;
  } catch (e) {
    return {};
  }
}
