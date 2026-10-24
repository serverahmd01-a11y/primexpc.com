import { getSetting } from "../models/setting.model.js";
import { sendEmail } from "./email.js";
import { logger } from "../utils/logger.js";
import { NotifyChannel } from "../models/notifyChannel.model.js";

/**
 * Configurable notification bots.
 * The admin creates channels (Admin → Bots): Telegram bot, WhatsApp (CallMeBot)
 * or Email — each subscribed to the shop events it cares about. Every event
 * fires here and is delivered to all matching channels. Failures are logged
 * and never block the order/user flow.
 *
 * Events:
 *  new_order      — order confirmed (browser or webhook), full details incl. payment
 *  new_user       — customer registration
 *  order_status   — admin changed an order status
 *  low_stock      — a product dropped to <= LOW_STOCK_THRESHOLD after a sale
 *  contact_form   — someone submitted the contact form
 *  missed_payment — payment captured at Razorpay but no order could be created
 */

export const LOW_STOCK_THRESHOLD = 3;

export const NOTIFY_EVENTS = [
  { key: "new_order", label: "New Order — any (COD + Prepaid)" },
  { key: "new_order_prepaid", label: "New PREPAID Order (full payment received)" },
  { key: "new_order_cod", label: "New COD Order (25% advance received)" },
  { key: "new_user", label: "New Customer Registered" },
  { key: "order_status", label: "Order Status Changed (shipped etc.)" },
  { key: "low_stock", label: "Low Stock Warning" },
  { key: "contact_form", label: "Contact Form Message" },
  { key: "missed_payment", label: "Payment Without Order (needs attention!)" },
];

async function sendTelegram(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    throw new Error(`Telegram error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function sendWhatsapp(phone, apikey, text) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WhatsApp error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

function channelReady(ch) {
  if (ch.type === "telegram") return !!(ch.telegramToken && ch.telegramChat);
  if (ch.type === "whatsapp") return !!(ch.whatsappPhone && ch.whatsappApikey);
  if (ch.type === "email") return !!ch.emailTo;
  return false;
}

async function deliver(ch, text, ctx) {
  try {
    if (!channelReady(ch)) {
      logger.order("WARN", `Bot "${ch.name}" (${ch.type}) is missing credentials — skipped`, ctx);
      return;
    }
    if (ch.type === "telegram") {
      await sendTelegram(ch.telegramToken, ch.telegramChat, text);
    } else if (ch.type === "whatsapp") {
      await sendWhatsapp(ch.whatsappPhone, ch.whatsappApikey, text.slice(0, 900));
    } else if (ch.type === "email") {
      const info = await sendEmail({
        to: ch.emailTo,
        subject: text.split("\n")[0].slice(0, 120),
        html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;background:#121212;color:#e0e0e0;padding:24px;border-radius:12px">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>`,
      });
      if (!info) throw new Error("SMTP not configured (Settings → Email)");
    }
    logger.order("INFO", `Bot notification sent`, { ...ctx, bot: ch.name, type: ch.type });
  } catch (e) {
    logger.order("ERROR", `Bot notification failed`, { ...ctx, bot: ch.name, type: ch.type, error: e.message });
  }
}

/**
 * Fire an event at every bot subscribed to it. Fire-and-forget safe.
 * payload: { title, lines: string[] }
 */
export async function dispatchNotification(event, payload) {
  return dispatchNotificationAny([event], payload);
}

/**
 * Fire at every bot subscribed to ANY of the given events — each bot gets the
 * message exactly once, even if it subscribes to several of them (so a bot
 * with both "new_order" and "new_order_prepaid" is not messaged twice).
 */
export async function dispatchNotificationAny(events, payload) {
  try {
    const channels = await NotifyChannel.find({ enabled: true, events: { $in: events } });
    if (channels.length === 0) return;
    const text = [payload.title, "", ...payload.lines].filter((l) => l !== undefined).join("\n");
    const ctx = { event: events.join("+") };
    for (const ch of channels) {
      deliver(ch, text, ctx); // async, not awaited — never blocks the flow
    }
  } catch (e) {
    logger.order("ERROR", "Notification dispatch crashed", { event: events.join("+"), error: e.message });
  }
}

export function buildOrderMessage(order, user) {
  const isCod = order.paymentResult?.status === "cod_advance";
  const orderNo = order.orderNumber || order._id.toString().slice(-6).toUpperCase();
  const payId = order.paymentResult?.id || "";
  const lines = [];
  lines.push(isCod ? `🛒 NEW ORDER #${orderNo} — COD 💵` : `🛒 NEW ORDER #${orderNo} — PREPAID ✅`);
  const addr = order.shippingAddress || {};
  lines.push(`👤 ${addr.fullName || user?.name || "-"} · 📞 ${addr.phoneNumber || "-"}`);
  lines.push("");
  for (const item of order.orderItems || []) {
    lines.push(`• ${item.name} × ${item.quantity} — ₹${(item.price * item.quantity).toLocaleString("en-IN")}`);
  }
  lines.push("");
  lines.push(`💰 Total: ₹${(order.totalPrice || 0).toLocaleString("en-IN")}`);
  if (isCod) {
    lines.push(`💵 COD: ₹${(order.codAdvanceAmount || 0).toLocaleString("en-IN")} advance received · ₹${(order.totalPrice - order.codAdvanceAmount).toLocaleString("en-IN")} balance on delivery`);
  } else {
    lines.push(`💳 PREPAID: full payment received${payId ? ` (${payId})` : ""}`);
  }
  lines.push("");
  if (user?.email) lines.push(`✉️ ${user.email}`);
  lines.push(`📍 ${[addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ") || "-"}`);
  return lines;
}

export async function sendOrderNotification(order, user, source = "unknown") {
  const lines = buildOrderMessage(order, user);
  const payload = { title: lines[0], lines: lines.slice(1) };
  // One delivery per bot: a bot subscribed to the generic event AND the
  // payment-type event still receives this order exactly once.
  const specific = order.paymentResult?.status === "cod_advance" ? "new_order_cod" : "new_order_prepaid";
  await dispatchNotificationAny(["new_order", specific], payload);
  logger.order("INFO", "Order notification dispatched to bots", {
    orderId: order?._id?.toString(),
    orderNumber: order?.orderNumber,
    paymentType: specific,
    source,
  });
}

// "Send Test" button on a saved bot — validates credentials too.
export async function sendTestToChannelDoc(ch) {
  const text = `✅ PrimeX PC bot "${ch.name}" is working — you will receive alerts here.`;
  if (!channelReady(ch)) {
    throw new Error(`Fill the ${ch.type} credentials for this bot first`);
  }
  if (ch.type === "telegram") await sendTelegram(ch.telegramToken, ch.telegramChat, text);
  else if (ch.type === "whatsapp") await sendWhatsapp(ch.whatsappPhone, ch.whatsappApikey, text);
  else {
    const info = await sendEmail({ to: ch.emailTo, subject: `PrimeX PC bot "${ch.name}" test`, html: `<p style="font-family:Arial">${text}</p>` });
    if (!info) throw new Error("SMTP is not configured — set it up in Settings → Email first");
  }
  return true;
}
