import { sendEmail } from "./email.js";
import { logger } from "../utils/logger.js";
import { NotifyChannel } from "../models/notifyChannel.model.js";

/**
 * Fully configurable notification bots (Admin → Bots).
 * Each bot picks channels (Telegram / WhatsApp / Email) and events. Per event
 * the admin can choose exactly WHICH fields appear in the message and even
 * write a custom template with {{placeholders}} — all from the admin panel.
 * Failures are logged and never block the order/user flow.
 */

export const LOW_STOCK_THRESHOLD = 3;

// [key, label] per event — drives the field pickers in the admin panel.
const ORDER_FIELDS = [
  ["orderNo", "Order number"],
  ["paymentType", "COD / Prepaid type"],
  ["items", "Items with per-item calculation"],
  ["itemCount", "Item count"],
  ["total", "Total amount"],
  ["advance", "Advance received (COD)"],
  ["balance", "Balance on delivery (COD)"],
  ["paymentId", "Payment ID"],
  ["customerName", "Customer name"],
  ["phone", "Phone number"],
  ["email", "Email"],
  ["address", "Full address"],
];

export const EVENT_FIELDS = {
  new_order: ORDER_FIELDS,
  new_order_prepaid: ORDER_FIELDS,
  new_order_cod: ORDER_FIELDS,
  new_user: [
    ["name", "Customer name"], ["email", "Email"], ["time", "Time (IST)"],
  ],
  order_status: [
    ["orderNo", "Order number"], ["customerName", "Customer name"], ["total", "Total amount"],
    ["fromStatus", "Old status"], ["toStatus", "New status"], ["by", "Changed by"],
  ],
  low_stock: [
    ["productName", "Product name"], ["stockLeft", "Stock left"], ["stockBefore", "Stock before"],
  ],
  contact_form: [
    ["name", "Name"], ["email", "Email"], ["subject", "Subject"], ["message", "Message"],
  ],
  missed_payment: [
    ["paymentId", "Payment ID"], ["amount", "Amount paid"], ["user", "User"], ["reason", "Reason"],
  ],
  sell_lead_new: [
    ["leadId", "Request number"], ["customerName", "Customer name"], ["mobile", "Mobile"],
    ["email", "Email"], ["items", "Products with expected prices"], ["expectedTotal", "Total expected"],
    ["pickupDate", "Preferred pickup date"], ["timeSlot", "Preferred time slot"], ["address", "Address"],
  ],
  sell_lead_status: [
    ["leadId", "Request number"], ["customerName", "Customer name"], ["fromStatus", "Old status"],
    ["toStatus", "New status"], ["offeredPrice", "Offered price"], ["note", "Note"],
  ],
  server_errors: [
    ["message", "Error message"], ["data", "Error details"], ["time", "Time (IST)"],
  ],
};

export const NOTIFY_EVENTS = [
  { key: "new_order", label: "New Order — any (COD + Prepaid)" },
  { key: "new_order_prepaid", label: "New PREPAID Order (full payment received)" },
  { key: "new_order_cod", label: "New COD Order (25% advance received)" },
  { key: "new_user", label: "New Customer Registered" },
  { key: "order_status", label: "Order Status Changed (shipped etc.)" },
  { key: "low_stock", label: "Low Stock Warning" },
  { key: "contact_form", label: "Contact Form Message" },
  { key: "missed_payment", label: "Payment Without Order (needs attention!)" },
  { key: "sell_lead_new", label: "New Sell Request (customer selling GPU)" },
  { key: "sell_lead_status", label: "Sell Request Status / Price Offer" },
  { key: "server_errors", label: "Server Errors (ERROR/FATAL logs)" },
];

const inr = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const istNowStr = () => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

// ---------- senders ----------

async function sendTelegram(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram error ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendWhatsapp(phone, apikey, text) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text.slice(0, 900))}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WhatsApp error ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
    if (ch.type === "telegram") await sendTelegram(ch.telegramToken, ch.telegramChat, text);
    else if (ch.type === "whatsapp") await sendWhatsapp(ch.whatsappPhone, ch.whatsappApikey, text);
    else if (ch.type === "email") {
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

// ---------- message building (customizable per bot per event) ----------

/** Compute every available placeholder's value for an event. */
function buildValues(event, c) {
  const v = {};
  if (event.startsWith("new_order")) {
    const order = c.order || {};
    const isCod = order.paymentResult?.status === "cod_advance";
    const addr = order.shippingAddress || {};
    v.orderNo = `#${order.orderNumber || String(order._id || "").slice(-6).toUpperCase()}`;
    v.paymentType = isCod ? "COD (25% advance)" : "PREPAID (full payment)";
    v.items = (order.orderItems || []).map((i) => `• ${i.name} × ${i.quantity} = ${inr(i.price * i.quantity)}`).join("\n") || "-";
    v.itemCount = String((order.orderItems || []).reduce((s, i) => s + i.quantity, 0));
    v.total = inr(order.totalPrice);
    v.advance = isCod ? inr(order.codAdvanceAmount) : "";
    v.balance = isCod ? inr((order.totalPrice || 0) - (order.codAdvanceAmount || 0)) : "";
    v.paymentId = order.paymentResult?.id || "";
    v.customerName = addr.fullName || c.user?.name || "-";
    v.phone = addr.phoneNumber || "-";
    v.email = c.user?.email || "";
    v.address = [addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ") || "-";
    return v;
  }
  if (event === "new_user") return { name: c.name || "-", email: c.email || "-", time: istNowStr() };
  if (event === "order_status") {
    return {
      orderNo: `#${c.orderNo || ""}`,
      customerName: c.customerName || "-",
      total: inr(c.total),
      fromStatus: c.from || "-", toStatus: c.to || "-", by: c.by || "admin",
    };
  }
  if (event === "low_stock") return { productName: c.name || "-", stockLeft: String(c.left ?? "-"), stockBefore: c.before != null ? String(c.before) : "" };
  if (event === "contact_form") return { name: c.name, email: c.email, subject: c.subject || "-", message: (c.message || "").slice(0, 500) };
  if (event === "missed_payment") return { paymentId: c.paymentId || "-", amount: c.amount || "-", user: c.user || "-", reason: c.reason || "-" };
  if (event === "sell_lead_new" || event === "sell_lead_status") {
    const lead = c.lead || {};
    const out = {
      leadId: `#${String(lead._id || "").slice(-6).toUpperCase()}`,
      customerName: lead.customerName || "-",
      mobile: lead.customerMobile || "-",
      email: lead.customerEmail || "",
      items: (lead.products || []).map((p) => `• ${p.brand} ${p.model} (${p.condition}) = ${inr(p.expectedPrice)}`).join("\n") || "-",
      expectedTotal: inr((lead.products || []).reduce((s, p) => s + (p.expectedPrice || 0), 0)),
      pickupDate: lead.preferredPickupDate ? new Date(lead.preferredPickupDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Any date",
      timeSlot: lead.preferredTimeSlot || "Any time",
      address: [lead.pickupAddress || lead.customerAddress, lead.customerCity, lead.customerPincode].filter(Boolean).join(", ") || "-",
      fromStatus: c.from || "-", toStatus: c.to || lead.status || "-",
      offeredPrice: lead.offeredPrice ? inr(lead.offeredPrice) : "",
      note: c.note || "",
    };
    return out;
  }
  if (event === "server_errors") {
    return { message: c.message || "-", data: c.data ? JSON.stringify(c.data).slice(0, 500) : "", time: istNowStr() };
  }
  return {};
}

/** Render a custom {{placeholder}} template. */
function renderTemplate(template, values) {
  return String(template)
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (values[key] !== undefined && values[key] !== "" ? String(values[key]) : "—"))
    .trim();
}

/** Default message = title + each selected field as "Label: value". */
function renderFields(title, fields, values, event) {
  const catalog = EVENT_FIELDS[event] || [];
  const lines = [];
  for (const [key] of catalog) {
    if (fields && !fields.includes(key)) continue;
    const val = values[key];
    if (val === undefined || val === "") continue;
    const label = catalog.find(([k]) => k === key)?.[1] || key;
    lines.push(`${label}: ${val}`);
  }
  return [title, "", ...lines].join("\n").trim();
}

/**
 * Fire at every bot subscribed to ANY of the given events — each bot gets the
 * message exactly once, formatted per ITS own event config (fields/template).
 * payload: { title, ctx }
 */
export async function dispatchNotificationAny(events, payload) {
  try {
    const channels = await NotifyChannel.find({ enabled: true, events: { $in: events } });
    if (channels.length === 0) return;
    const ctx = { event: events.join("+") };
    for (const ch of channels) {
      const eventKey = events.find((e) => ch.events.includes(e)) || events[0];
      const cfg = (ch.eventConfigs || []).find((c) => c.event === eventKey);
      const values = buildValues(eventKey, payload.ctx || {});
      const text = cfg?.template?.trim()
        ? renderTemplate(cfg.template, values)
        : renderFields(payload.title, cfg?.fields, values, eventKey);
      deliver(ch, text || payload.title, ctx);
    }
  } catch (e) {
    logger.order("ERROR", "Notification dispatch crashed", { event: events.join("+"), error: e.message });
  }
}

export async function dispatchNotification(event, payload) {
  return dispatchNotificationAny([event], payload);
}

export async function sendOrderNotification(order, user, source = "unknown") {
  const specific = order.paymentResult?.status === "cod_advance" ? "new_order_cod" : "new_order_prepaid";
  await dispatchNotificationAny(["new_order", specific], {
    title: `🛒 NEW ORDER ${order.orderNumber ? "#" + order.orderNumber : ""} — ${specific === "new_order_cod" ? "COD 💵" : "PREPAID ✅"}`,
    ctx: { order, user },
  });
  logger.order("INFO", "Order notification dispatched to bots", {
    orderId: order?._id?.toString(),
    orderNumber: order?.orderNumber,
    paymentType: specific,
    source,
  });
}

// Server error alerts (ERROR/FATAL from any logger) — throttled to avoid spam.
let lastErrorAlertAt = 0;
export async function dispatchErrorAlert(level, message, data) {
  if (/Bot notification|Notification dispatch/i.test(message)) return; // never alert about the alerts (loop guard)
  if (Date.now() - lastErrorAlertAt < 30_000) return;
  lastErrorAlertAt = Date.now();
  await dispatchNotification("server_errors", {
    title: `🚨 Server ${level}`,
    ctx: { message, data },
  });
}

// "Send Test" button on a saved bot — validates credentials too.
export async function sendTestToChannelDoc(ch) {
  const text = `✅ PrimeX PC bot "${ch.name}" is working — you will receive alerts here.`;
  if (!channelReady(ch)) throw new Error(`Fill the ${ch.type} credentials for this bot first`);
  if (ch.type === "telegram") await sendTelegram(ch.telegramToken, ch.telegramChat, text);
  else if (ch.type === "whatsapp") await sendWhatsapp(ch.whatsappPhone, ch.whatsappApikey, text);
  else {
    const info = await sendEmail({ to: ch.emailTo, subject: `PrimeX PC bot "${ch.name}" test`, html: `<p style="font-family:Arial">${text}</p>` });
    if (!info) throw new Error("SMTP is not configured — set it up in Settings → Email first");
  }
  return true;
}
