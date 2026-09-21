import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  condition: {
    type: String,
    enum: ["new", "refurbished"],
    default: "new",
  },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    guestId: {
      type: String,
      index: true,
      sparse: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

cartSchema.statics.findCart = async function ({ userId, guestId }) {
  if (userId) {
    return this.findOne({ user: userId });
  }
  if (guestId) {
    return this.findOne({ guestId });
  }
  return null;
};

cartSchema.statics.mergeGuestCart = async function (userId, guestId) {
  if (!guestId || !userId) return null;

  const guestCart = await this.findOne({ guestId }).populate("items.product");
  if (!guestCart || guestCart.items.length === 0) return null;

  let userCart = await this.findOne({ user: userId });
  if (!userCart) {
    userCart = await this.create({ user: userId, items: [] });
  }

  for (const guestItem of guestCart.items) {
    const cond = guestItem.condition || "new";
    const existing = userCart.items.find(
      (i) => i.product.toString() === guestItem.product._id.toString() && i.condition === cond
    );
    if (existing) {
      existing.quantity += guestItem.quantity;
    } else {
      userCart.items.push({
        product: guestItem.product._id,
        quantity: guestItem.quantity,
        condition: cond,
      });
    }
  }

  await userCart.save();
  await this.deleteOne({ _id: guestCart._id });

  return this.findOne({ user: userId }).populate("items.product");
};

export const Cart = mongoose.model("Cart", cartSchema);
