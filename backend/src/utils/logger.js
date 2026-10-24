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
// Ordered for the admin Logs page "All types" merged timeline.
export const LOG_TYPES = ["order", "payment", "auth", "admin", "error"];

// All log timestamps and file names use IST (Asia/Kolkata) so the admin panel
// shows the same clock the shop runs on — UTC naming made late-night entries
// land in "yesterday's" file and times looked 5.5 hours behind.
const IST_DATETIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function istNow() {
  const parts = {};
  for (const part of IST_DATETIME.formatToParts(new Date())) {
    parts[part.type] = part.value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function istDateString() {
  return istNow().date;
}

function getLogFile(type) {
  const today = istNow().date;
  return path.join(LOG_DIR, `${type}_${today}.log`);
}

function formatLog(level, message, data) {
  const now = istNow();
  const ts = `${now.date} ${now.time} IST`;
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
  const file = getLogFilePath(type, date);
  if (!file) return [];
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\[(.+?)\] \[(.+?)\] (.*)$/);
        if (!match) return { timestamp: "", level: "UNKNOWN", message: line, data: null };
        let message = match[3];
        let data = null;
        // Split the trailing "| {json}" payload into a structured `data` field
        // so the admin page can render it as pretty, collapsible JSON.
        const sep = message.lastIndexOf(" | ");
        if (sep !== -1) {
          const tail = message.slice(sep + 3);
          if (tail.startsWith("{") || tail.startsWith("[")) {
            try {
              data = JSON.parse(tail);
              message = message.slice(0, sep);
            } catch { /* not JSON — keep the line intact */ }
          }
        }
        return { timestamp: match[1], level: match[2], message, data };
      });
  } catch (e) {
    return [];
  }
}

// Absolute path of a log file (null if type is invalid), used by the
// download endpoint. Path-traversal safe.
export function getLogFilePath(type, date) {
  if (!VALID_LOG_TYPES.has(type)) return null;
  const day = date || istNow().date;
  const file = path.join(LOG_DIR, `${type}_${day}.log`);
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.resolve(LOG_DIR))) return null;
  return resolved;
}

export function getAvailableLogFiles() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const groups = {};
    for (const f of files) {
      const match = f.match(/^(\w+)_(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) continue;
      const type = match[1];
      const date = match[2];
      if (!VALID_LOG_TYPES.has(type)) continue;
      if (!groups[type]) groups[type] = [];

      // Entry/error counts per file power the badges in the admin Logs page.
      let entries = 0;
      let errors = 0;
      let warns = 0;
      try {
        const content = fs.readFileSync(path.join(LOG_DIR, f), "utf-8");
        for (const line of content.split("\n")) {
          if (!line) continue;
          entries++;
          if (line.includes("] [ERROR]") || line.includes("] [FATAL]")) errors++;
          else if (line.includes("] [WARN]")) warns++;
        }
      } catch { /* unreadable file — show it without counts */ }

      groups[type].push({ date, file: f, entries, errors, warns });
    }
    for (const type of Object.keys(groups)) {
      groups[type].sort((a, b) => b.date.localeCompare(a.date));
    }
    return groups;
  } catch (e) {
    return {};
  }
}
