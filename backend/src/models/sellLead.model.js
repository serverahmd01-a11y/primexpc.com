import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ["front", "back", "ports", "serial", "box", "invoice", "accessories", "other"], default: "other" },
}, { _id: false });

const videoSchema = new mongoose.Schema({
  url: { type: String, required: true },
}, { _id: false });

const checklistSchema = new mongoose.Schema({
  powersOn: { type: Boolean, default: false },
  noPhysicalDamage: { type: Boolean, default: false },
  noLiquidDamage: { type: Boolean, default: false },
  noBurningSmell: { type: Boolean, default: false },
  allPortsWorking: { type: Boolean, default: false },
  displayOutputWorking: { type: Boolean, default: false },
  fansWorking: { type: Boolean, default: false },
  neverRepaired: { type: Boolean, default: false },
  miningUsed: { type: Boolean, default: false },
}, { _id: false });

const productItemSchema = new mongoose.Schema({
  category: { type: String, required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  serialNumber: { type: String, default: "" },
  purchaseDate: { type: Date, default: null },
  warrantyRemaining: { type: Boolean, default: false },
  warrantyMonths: { type: Number, default: 0 },
  condition: {
    type: String,
    enum: ["perfectly_working", "minor_issue", "needs_repair", "dead"],
    required: true,
  },
  accessories: [{ type: String }],
  expectedPrice: { type: Number, default: 0 },
  description: { type: String, default: "" },
  checklist: { type: checklistSchema, default: () => ({}) },
}, { _id: true });

const adminNoteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String, default: "" },
}, { _id: true });

const sellLeadSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerMobile: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerAddress: { type: String, required: true },
  customerCity: { type: String, required: true },
  customerState: { type: String, required: true },
  customerPincode: { type: String, required: true },
  gstNumber: { type: String, default: "" },
  isOtpVerified: { type: Boolean, default: false },

  products: {
    type: [productItemSchema],
    required: true,
    validate: {
      validator: function (v) { return v && v.length > 0; },
      message: "At least one product is required",
    },
  },

  photos: [photoSchema],
  videos: [videoSchema],

  pickupAddress: { type: String, default: "" },
  preferredPickupDate: { type: Date, default: null },
  preferredTimeSlot: { type: String, enum: ["morning", "afternoon", "evening", ""], default: "" },

  status: {
    type: String,
    enum: [
      "new",
      "contacted",
      "price_offered",
      "accepted",
      "rejected",
      "pickup_scheduled",
      "picked_up",
      "in_transit",
      "received",
      "testing",
      "payment_pending",
      "paid",
      "completed",
      "cancelled",
    ],
    default: "new",
  },

  offeredPrice: { type: Number, default: 0 },
  adminNotes: [adminNoteSchema],
  statusHistory: [statusHistorySchema],

  shiprocketOrderId: { type: String, default: "" },
  shiprocketShipmentId: { type: String, default: "" },
  awbNumber: { type: String, default: "" },
  courierName: { type: String, default: "" },
  trackingUrl: { type: String, default: "" },

  packageWeight: { type: Number, default: 1 },
  packageLength: { type: Number, default: 30 },
  packageBreadth: { type: Number, default: 30 },
  packageHeight: { type: Number, default: 30 },
  declaredValue: { type: Number, default: 0 },
}, { timestamps: true });

sellLeadSchema.index({ status: 1 });
sellLeadSchema.index({ customerMobile: 1 });
sellLeadSchema.index({ createdAt: -1 });

sellLeadSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const statusLabels = {
      new: "New",
      contacted: "Contacted",
      price_offered: "Price Offered",
      accepted: "Accepted",
      rejected: "Rejected",
      pickup_scheduled: "Pickup Scheduled",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      received: "Received",
      testing: "Testing",
      payment_pending: "Payment Pending",
      paid: "Paid",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: "",
    });
  }
  next();
});

export const SellLead = mongoose.model("SellLead", sellLeadSchema);
