import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { Review } from "../models/review.model.js";
import { Cart } from "../models/cart.model.js";
import { generateOrderNumber } from "../utils/order.util.js";
import { sendOrderConfirmation } from "../config/email.js";
import { logger } from "../utils/logger.js";
import { getRazorpayKeys } from "../models/setting.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";

async function verifyCodAdvance(paymentResult, razorpayOrderId, razorpaySignature, expectedAdvancePaise) {
  if (!paymentResult?.id || !razorpayOrderId || !razorpaySignature) {
    return { ok: false, error: "Payment verification data missing" };
  }
  const keys = await getRazorpayKeys();
  if (!keys.key_id || !keys.key_secret) {
    return { ok: false, error: "Razorpay keys not configured" };
  }
  const expected = crypto
    .createHmac("sha256", keys.key_secret)
    .update(`${razorpayOrderId}|${paymentResult.id}`)
    .digest("hex");
  const a = Buffer.from(razorpaySignature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "Invalid payment signature" };
  }
  try {
    const razorpay = new Razorpay({ key_id: keys.key_id, key_secret: keys.key_secret });
    const rzpPayment = await razorpay.payments.fetch(paymentResult.id);
    if (rzpPayment.status !== "captured") {
      return { ok: false, error: `Payment not captured (status: ${rzpPayment.status})` };
    }
    const paidPaise = Number(rzpPayment.amount) || 0;
    if (Math.abs(paidPaise - expectedAdvancePaise) > 200) {
      return { ok: false, error: `Paid amount does not match 25% advance (₹${(paidPaise / 100).toFixed(2)} vs ₹${(expectedAdvancePaise / 100).toFixed(2)})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Payment not found at Razorpay" };
  }
}

export async function createOrder(req, res) {
  try {
    const user = req.user;
    const { orderItems, shippingAddress, paymentResult, totalPrice, codAdvanceAmount, razorpay_order_id, razorpay_signature } = req.body;

    logger.order("INFO", "COD order request received", {
      userId: user._id?.toString(),
      email: user.email,
      itemsCount: orderItems?.length || 0,
      isCod: paymentResult?.status === "cod_advance",
      totalPrice,
      codAdvanceAmount,
    });

    if (!orderItems || orderItems.length === 0) {
      logger.order("WARN", "Order rejected - no items", { userId: user._id?.toString() });
      return res.status(400).json({ error: "No order items" });
    }

    let serverTotal = 0;
    const validatedItems = [];

    for (const item of orderItems) {
      const productId = typeof item.product === "string" ? item.product : item.product?._id || item.productId;
      if (!productId) {
        logger.order("WARN", "Order rejected - product ID missing", { itemName: item.name, userId: user._id?.toString() });
        return res.status(400).json({ error: "Product ID missing" });
      }
      const product = await Product.findById(productId);
      if (!product) {
        logger.order("ERROR", "Product not found", { productId, itemName: item.name, userId: user._id?.toString() });
        return res.status(404).json({ error: `Product ${item.name} not found` });
      }
      const price = Number(product.salePrice) || Number(product.price);
      if (!price || price <= 0) {
        return res.status(400).json({ error: `Product has no valid price: ${product.name}` });
      }
      const quantity = Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 0;
      if (!quantity) {
        return res.status(400).json({ error: `Invalid quantity for ${product.name}` });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ error: `Insufficient stock: ${product.name} — only ${product.stock} left` });
      }
      serverTotal += price * quantity;
      validatedItems.push({
        product: product._id,
        name: product.name,
        price,
        quantity,
        gstRate: product.gstRate || 18,
        image: product.images?.[0] || "",
      });
    }

    const isCod = paymentResult?.status === "cod_advance";

    if (isCod) {
      if (!paymentResult?.id) {
        logger.order("WARN", "COD order rejected - payment ID missing", { userId: user._id?.toString() });
        return res.status(400).json({ error: "Payment verification data missing for COD" });
      }
    } else {
      return res.status(400).json({ error: "Invalid payment method. Use /api/payment/place-order for prepaid orders." });
    }

    const orderNumber = await generateOrderNumber(Order);
    logger.order("INFO", "Order number generated", { orderNumber });

    const order = await Order.create({
      user: user._id,
      orderNumber,
      orderItems: validatedItems,
      shippingAddress,
      paymentResult,
      totalPrice: serverTotal,
      codAdvanceAmount: Math.round(serverTotal * 0.25),
      advancePaid: true,
      balancePaid: false,
      balancePaidAt: null,
    });

    logger.order("SUCCESS", "Order created", {
      orderId: order._id?.toString(),
      orderNumber,
      userId: user._id?.toString(),
      email: user.email,
      total: serverTotal,
      isCod,
      codAdvance: order.codAdvanceAmount,
      items: validatedItems.map((i) => ({ product: i.product.toString(), qty: i.quantity })),
    });

    for (const item of validatedItems) {
      await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
    }

    await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [] } });
    logger.order("INFO", "Cart cleared and stock updated", { userId: user._id?.toString() });

    if (user.email) {
      sendOrderConfirmation(order, user.email).catch((e) => {
        logger.order("ERROR", "Failed to send confirmation email", { error: e.message, email: user.email });
      });
    }

    res.status(201).json({ message: "Order created successfully", order });

  } catch (error) {
    logger.order("FATAL", "Order creation failed", {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id?.toString(),
      body: req.body,
    });
    console.error("Error in createOrder controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserOrders(req, res) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    const orderIds = orders.map((order) => order._id);
    const reviews = await Review.find({ orderId: { $in: orderIds } });
    const reviewedOrderIds = new Set(reviews.map((review) => review.orderId.toString()));

    const ordersWithReviewStatus = await Promise.all(
      orders.map(async (order) => {
        return {
          ...order.toObject(),
          hasReviewed: reviewedOrderIds.has(order._id.toString()),
        };
      })
    );

    res.status(200).json({ orders: ordersWithReviewStatus });
  } catch (error) {
    console.error("Error in getUserOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
