import { NotifyChannel } from "../models/notifyChannel.model.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { getSetting, setSetting } from "../models/setting.model.js";
import { logger } from "../utils/logger.js";

/**
 * Interactive Telegram report bot ("akhu app nu bot").
 * The admin marks ONE Telegram bot as interactive in Admin → Bots. This
 * service then long-polls Telegram for commands from the bot's own chat and
 * replies with live shop reports. Only the configured chat ID is answered.
 *
 * Commands:
 *   /help     — list everything
 *   /today    — today's business (IST)
 *   /month    — this month's business + top products
 *   /pending  — COD orders with balance payment pending
 *   /recent   — last 5 orders
 *   /stock    — products low on stock (<= 3)
 *
 * Also sends an automatic daily summary at 21:30 IST.
 */

const IST = "+05:30";
const inr = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

function istNowString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
}

function istDayStart() {
  const d = istNowString();
  return Date.parse(`${d.year}-${d.month}-${d.day}T00:00:00${IST}`);
}

function istMonthStart() {
  const d = istNowString();
  return Date.parse(`${d.year}-${d.month}-01T00:00:00${IST}`);
}

async function tgCall(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} failed (${res.status})`);
  }
  return data;
}

// ---------- report builders ----------

async function buildRangeReport(startMs, label) {
  const match = { isDraft: { $ne: true }, createdAt: { $gte: new Date(startMs) } };
  const orders = await Order.find(match).sort({ createdAt: -1 }).limit(1000);

  const active = orders.filter((o) => !["cancelled", "returned"].includes(o.status));
  const revenue = active.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const cod = active.filter((o) => o.paymentResult?.status === "cod_advance");
  const prepaid = active.length - cod.length;
  const codPending = active
    .filter((o) => o.paymentResult?.status === "cod_advance" && !o.balancePaid)
    .reduce((s, o) => s + ((o.totalPrice || 0) - (o.codAdvanceAmount || 0)), 0);

  const topProducts = await Order.aggregate([
    { $match: { ...match, status: { $nin: ["cancelled", "returned"] } } },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.name",
        qty: { $sum: "$orderItems.quantity" },
        revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: 3 },
  ]);

  const lines = [
    `📊 ${label}`,
    "",
    `📦 Orders: ${active.length} (Prepaid ${prepaid} · COD ${cod.length})`,
    `💰 Business: ${inr(revenue)}`,
    active.length ? `📈 Avg order: ${inr(Math.round(revenue / active.length))}` : null,
    `💵 COD balance pending: ${inr(codPending)}`,
  ];
  if (topProducts.length) {
    lines.push("", "🏆 Top products:");
    topProducts.forEach((p, i) => lines.push(`${i + 1}. ${p._id} — ${p.qty} pcs · ${inr(p.revenue)}`));
  }
  return lines.filter(Boolean).join("\n");
}

async function buildPending() {
  const orders = await Order.find({
    isDraft: { $ne: true },
    "paymentResult.status": "cod_advance",
    balancePaid: false,
  })
    .sort({ createdAt: -1 })
    .limit(10);
  const total = await Order.countDocuments({
    isDraft: { $ne: true },
    "paymentResult.status": "cod_advance",
    balancePaid: false,
  });
  if (total === 0) return "✅ No pending COD balance payments — all settled!";

  const lines = [`💵 COD balance pending — ${total} order(s):`, ""];
  for (const o of orders) {
    const balance = (o.totalPrice || 0) - (o.codAdvanceAmount || 0);
    const age = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 86400000);
    lines.push(`#${o.orderNumber || "?"} · ${inr(balance)} · ${o.shippingAddress?.fullName || "-"} · ${age}d old · ${o.status}`);
  }
  lines.push("", "Mark as settled in Admin → Orders (Settle button).");
  return lines.join("\n");
}

async function buildRecent() {
  const orders = await Order.find({ isDraft: { $ne: true } }).sort({ createdAt: -1 }).limit(5);
  if (orders.length === 0) return "No orders yet.";
  const lines = ["🕐 Last 5 orders:", ""];
  for (const o of orders) {
    const type = o.paymentResult?.status === "cod_advance" ? "COD" : "PREPAID";
    lines.push(`#${o.orderNumber || "?"} · ${inr(o.totalPrice)} · ${type} · ${o.status} · ${o.shippingAddress?.fullName || "-"}`);
  }
  return lines.join("\n");
}

async function buildLowStock() {
  const products = await Product.find({ stock: { $lte: 3 } }).sort({ stock: 1 }).limit(10);
  if (products.length === 0) return "✅ All products are well stocked!";
  const lines = ["⚠️ Low stock (<= 3):", ""];
  for (const p of products) lines.push(`• ${p.name} — ${p.stock} left`);
  return lines.join("\n");
}

const HELP_TEXT = [
  "🤖 PrimeX PC Report Bot",
  "",
  "/today — today's business",
  "/month — this month's business + top products",
  "/pending — COD orders with balance payment pending",
  "/recent — last 5 orders",
  "/stock — low stock products",
  "/help — this menu",
  "",
  "You also get an automatic daily summary at 9:30 PM IST.",
].join("\n");

async function handleCommand(text) {
  const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, "");
  try {
    switch (cmd) {
      case "/start":
      case "/help":
        return HELP_TEXT;
      case "/today":
        return buildRangeReport(istDayStart(), "Today's business (IST)");
      case "/month":
      case "/report":
        return buildRangeReport(istMonthStart(), "This month's business (IST)");
      case "/pending":
        return buildPending();
      case "/recent":
        return buildRecent();
      case "/stock":
        return buildLowStock();
      default:
        return `Unknown command. ${HELP_TEXT.split("\n").slice(0, 8).join("\n")}`;
    }
  } catch (e) {
    logger.error("ERROR", "Report bot command failed", { command: cmd, error: e.message });
    return "⚠️ Something went wrong building that report — check Admin → Logs.";
  }
}

// ---------- polling ----------

let currentKey = null;
let generation = 0;
const offsets = {}; // token -> last update_id, survives bot re-save within the process

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findInteractiveBot() {
  return NotifyChannel.findOne({ type: "telegram", enabled: true, interactive: true });
}

function runLoop(bot, gen) {
  (async () => {
    logger.admin("INFO", "Telegram report bot is live", { bot: bot.name, commands: ["/today", "/month", "/pending", "/recent", "/stock"] });
    while (gen === generation) {
      try {
        const offset = offsets[bot.telegramToken] || 0;
        const res = await fetch(`https://api.telegram.org/bot${bot.telegramToken}/getUpdates?timeout=25&offset=${offset}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.description || `getUpdates ${res.status}`);
        for (const update of data.result || []) {
          offsets[bot.telegramToken] = update.update_id + 1;
          if (gen !== generation) return;
          const msg = update.message;
          if (!msg?.text) continue;
          if (String(msg.chat.id) !== String(bot.telegramChat)) continue; // only our chat
          const reply = await handleCommand(msg.text.trim());
          await tgCall(bot.telegramToken, "sendMessage", {
            chat_id: bot.telegramChat,
            text: typeof reply === "string" ? reply : await reply,
            disable_web_page_preview: true,
          }).catch((e) => logger.error("ERROR", "Report bot reply failed", { error: e.message }));
        }
      } catch (e) {
        // Bad token / network down — stay quiet in the file logs, retry shortly.
        console.error("[report-bot] polling error:", e.message);
        await sleep(5000);
      }
    }
  })();
}

async function dailySummary(bot) {
  const now = istNowString();
  const hhmm = `${now.hour}:${now.minute}`;
  const today = `${now.year}-${now.month}-${now.day}`;
  const scheduledAt = bot.dailySummaryTime || "21:30";
  if (hhmm !== scheduledAt) return;
  const lastSent = await getSetting("reportbot_last_daily", "");
  if (lastSent === today) return;
  await setSetting("reportbot_last_daily", today);
  try {
    const day = await buildRangeReport(istDayStart(), "Today's business (IST)");
    const pending = await buildPending();
    await tgCall(bot.telegramToken, "sendMessage", {
      chat_id: bot.telegramChat,
      text: `🌙 Daily Summary\n\n${day}\n\n———\n${pending}`,
      disable_web_page_preview: true,
    });
    logger.admin("INFO", "Report bot daily summary sent", { bot: bot.name });
  } catch (e) {
    logger.error("ERROR", "Report bot daily summary failed", { error: e.message });
  }
}

/** Start the service — safe to call repeatedly; re-reads config every minute. */
export function startReportBot() {
  restartReportBot();
  setInterval(restartReportBot, 60_000);
  setInterval(async () => {
    const bot = await findInteractiveBot();
    if (bot && bot.telegramToken && bot.telegramChat) dailySummary(bot);
  }, 60_000);
}

export async function restartReportBot() {
  try {
    const bot = await findInteractiveBot();
    const key = bot && bot.telegramToken && bot.telegramChat ? `${bot._id}:${bot.telegramToken}:${bot.telegramChat}` : null;
    if (key === currentKey) return;
    currentKey = key;
    generation++;
    if (!bot) {
      logger.admin("INFO", "Report bot stopped — no interactive Telegram bot configured", {});
      return;
    }
    runLoop(bot, generation);
  } catch (e) {
    logger.error("ERROR", "Report bot restart failed", { error: e.message });
  }
}
