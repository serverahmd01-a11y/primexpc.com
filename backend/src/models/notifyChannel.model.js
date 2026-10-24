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
    // Interactive bots only: when the automatic daily summary is sent (IST, HH:MM).
    dailySummaryTime: { type: String, default: "21:30" },
    // Per-event customization from the admin panel:
    //   fields   → which placeholders appear in the default message
    //   template → free-form message using {{placeholders}} (overrides fields)
    eventConfigs: [{
      event: String,
      fields: [String],
      template: { type: String, default: "" },
    }],
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
