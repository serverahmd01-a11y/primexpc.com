import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  condition: {
    type: String,
    enum: ["new", "refurbished"],
    default: "new",
  },
  gstRate: {
    type: Number,
    default: 18,
  },
  image: {
    type: String,
    default: "",
  },
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  streetAddress: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: {
      type: Number,
      unique: true,
      sparse: true,
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    paymentResult: {
      id: String,
      status: String,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
    },
    deliveredAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    shiprocket_shipment_id: { type: String, default: "" },
    shiprocket_order_id: { type: String, default: "" },
    shiprocket_awb: { type: String, default: "" },
    shiprocket_courier_id: { type: String, default: "" },
    shiprocket_courier_name: { type: String, default: "" },
    returnReason: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    advancePaid: { type: Boolean, default: false },
    codAdvanceAmount: { type: Number, default: 0 },
    balancePaid: { type: Boolean, default: false },
    balancePaidAt: { type: Date, default: null },
    isMissedOrder: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ "paymentResult.id": 1 }, { unique: true, sparse: true });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ isMissedOrder: 1 });

export const Order = mongoose.model("Order", orderSchema);
