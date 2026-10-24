import { Router } from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { NotifyChannel } from "../models/notifyChannel.model.js";
import { NOTIFY_EVENTS, sendTestToChannelDoc } from "../config/notify.js";
import { restartReportBot } from "../config/telegramReportBot.js";
import { logger } from "../utils/logger.js";

const router = Router();
const SECRET_MASK = "••••••••";
const VALID_EVENTS = new Set(NOTIFY_EVENTS.map((e) => e.key));

// Secrets are masked in responses; masked/empty values on update keep the old one.
function toSafe(ch) {
  return {
    _id: ch._id,
    name: ch.name,
    type: ch.type,
    enabled: ch.enabled,
    events: ch.events,
    interactive: ch.interactive || false,
    telegramToken: ch.telegramToken ? SECRET_MASK : "",
    telegramChat: ch.telegramChat,
    whatsappPhone: ch.whatsappPhone,
    whatsappApikey: ch.whatsappApikey ? SECRET_MASK : "",
    emailTo: ch.emailTo,
    createdAt: ch.createdAt,
  };
}

function applyBody(ch, body) {
  if (body.name !== undefined) ch.name = String(body.name).trim();
  if (body.type !== undefined && ["telegram", "whatsapp", "email"].includes(body.type)) ch.type = body.type;
  if (body.enabled !== undefined) ch.enabled = body.enabled === true;
  if (body.interactive !== undefined) {
    // Only one Telegram bot can be the interactive report bot.
    ch.interactive = body.interactive === true && ch.type === "telegram";
    if (ch.interactive && ch.events.length === 0) {
      ch.events = ["new_order"]; // give it something useful by default
    }
  }
  if (body.events !== undefined) {
    const events = (Array.isArray(body.events) ? body.events : []).filter((e) => VALID_EVENTS.has(e));
    ch.events = events;
  }
  if (body.telegramToken !== undefined && body.telegramToken !== SECRET_MASK) ch.telegramToken = String(body.telegramToken).trim();
  if (body.telegramChat !== undefined) ch.telegramChat = String(body.telegramChat).trim();
  if (body.whatsappPhone !== undefined) ch.whatsappPhone = String(body.whatsappPhone).trim();
  if (body.whatsappApikey !== undefined && body.whatsappApikey !== SECRET_MASK) ch.whatsappApikey = String(body.whatsappApikey).trim();
  if (body.emailTo !== undefined) ch.emailTo = String(body.emailTo).trim();
}

router.get("/", protectRoute, adminOnly, async (req, res) => {
  try {
    const channels = await NotifyChannel.find().sort({ createdAt: 1 });
    res.status(200).json({ channels: channels.map(toSafe), events: NOTIFY_EVENTS });
  } catch (err) {
    res.status(500).json({ error: "Failed to load bots" });
  }
});

router.post("/", protectRoute, adminOnly, async (req, res) => {
  try {
    const ch = new NotifyChannel();
    applyBody(ch, req.body);
    if (!ch.name) return res.status(400).json({ error: "Bot name is required" });
    await ch.save();
    if (ch.interactive) {
      await NotifyChannel.updateMany({ _id: { $ne: ch._id } }, { $set: { interactive: false } });
    }
    restartReportBot();
    logger.admin("SUCCESS", "Notification bot created", { actor: req.user?.email, bot: ch.name, type: ch.type, events: ch.events, interactive: ch.interactive });
    res.status(201).json({ message: "Bot created", channel: toSafe(ch) });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to create bot" });
  }
});

router.put("/:id", protectRoute, adminOnly, async (req, res) => {
  try {
    const ch = await NotifyChannel.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Bot not found" });
    applyBody(ch, req.body);
    await ch.save();
    if (ch.interactive) {
      await NotifyChannel.updateMany({ _id: { $ne: ch._id } }, { $set: { interactive: false } });
    }
    restartReportBot();
    logger.admin("SUCCESS", "Notification bot updated", { actor: req.user?.email, bot: ch.name, enabled: ch.enabled, interactive: ch.interactive });
    res.status(200).json({ message: "Bot updated", channel: toSafe(ch) });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to update bot" });
  }
});

router.delete("/:id", protectRoute, adminOnly, async (req, res) => {
  try {
    const ch = await NotifyChannel.findByIdAndDelete(req.params.id);
    if (!ch) return res.status(404).json({ error: "Bot not found" });
    restartReportBot();
    logger.admin("WARN", "Notification bot deleted", { actor: req.user?.email, bot: ch.name });
    res.status(200).json({ message: "Bot deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete bot" });
  }
});

router.post("/:id/test", protectRoute, adminOnly, async (req, res) => {
  try {
    const ch = await NotifyChannel.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Bot not found" });
    await sendTestToChannelDoc(ch);
    res.status(200).json({ message: "Test sent — check your phone/inbox" });
  } catch (err) {
    res.status(400).json({ error: err.message || "Test failed" });
  }
});

export default router;
