import mongoose from "mongoose";

// A "bot" = one notification channel the admin creates from the panel.
// It carries its own credentials and the list of shop events it listens to.
const notifyChannelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["telegram", "whatsapp", "email"], required: true },
    enabled: { type: Boolean, default: true },
    events: { type: [String], default: [] },
    // Telegram only: makes this the interactive report bot (/today, /month, /pending...).
    interactive: { type: Boolean, default: false },
    // Telegram
    telegramToken: { type: String, default: "" },
    telegramChat: { type: String, default: "" },
    // WhatsApp (CallMeBot)
    whatsappPhone: { type: String, default: "" },
    whatsappApikey: { type: String, default: "" },
    // Email (uses global SMTP)
    emailTo: { type: String, default: "" },
  },
  { timestamps: true }
);

notifyChannelSchema.index({ enabled: 1 });

export const NotifyChannel = mongoose.model("NotifyChannel", notifyChannelSchema);
