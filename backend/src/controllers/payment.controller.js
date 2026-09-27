import Razorpay from "razorpay";
import crypto from "crypto";
import { getRazorpayKeys } from "../models/setting.model.js";
import { sendOrderConfirmation } from "../config/email.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { User } from "../models/user.model.js";
import { generateOrderNumber } from "../utils/order.util.js";

async function getRazorpayInstance() {
  const keys = await getRazorpayKeys();
  const key_id = keys.key_id;
  const key_secret = keys.key_secret;
  if (!key_id || !key_secret) throw new Error("Razorpay keys not configured");
  return { razorpay: new Razorpay({ key_id, key_secret }), key_id, key_secret };
}

export async function createRazorpayOrder(req, res) {
  try {
    const { amount, receipt } = req.body;
    const user = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const cart = await Cart.findOne({ user: user._id }).populate("items.product");
    const cartSubtotal = cart
      ? cart.items.reduce((sum, i) => sum + (i.product.salePrice || i.product.price || 0) * i.quantity, 0)
      : 0;
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const allowedAmounts = [
      Math.round(cartSubtotal * 100),
      Math.round(cartSubtotal) * 100,
      Math.round(cartSubtotal * 0.25) * 100,
      Math.round(cartSubtotal * 0.25 * 100),
    ];
    const requested = Math.round(Number(amount));
    const matches = allowedAmounts.some((a) => Math.abs(a - requested) <= 100);
    if (!matches) {
      return res.status(400).json({ error: "Amount does not match cart total" });
    }

    const { razorpay, key_id } = await getRazorpayInstance();

    const order = await razorpay.orders.create({
      amount: requested,
      currency: "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        email: user.email,
        expectedAmount: String(requested),
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: key_id,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: error.message || "Failed to create payment order" });
  }
}

export async function verifyRazorpayPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification data" });
    }

    const { key_secret } = await getRazorpayKeys();
    const secret = key_secret;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const sigBuffer = Buffer.from(razorpay_signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const verified = sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (verified) {
      res.status(200).json({ verified: true, orderId: razorpay_order_id });
    } else {
      res.status(400).json({ verified: false, error: "Signature mismatch" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Payment verification failed" });
  }
}

export async function handleWebhook(req, res) {
  try {
    const { webhook_secret } = await getRazorpayKeys();
    const secret = webhook_secret;
    if (!secret) {
      console.error("Razorpay webhook secret not configured - rejecting webhook");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing webhook signature" });
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuffer = Buffer.from(String(signature), "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};

      const cart = await Cart.findOne({ user: notes.userId }).populate("items.product");
      if (!cart || cart.items.length === 0) {
        return res.json({ received: true });
      }

      const orderItems = cart.items.map((item) => ({
        product: item.product._id,
        name: item.product.name,
        price: item.product.salePrice || item.product.price,
        quantity: item.quantity,
        gstRate: item.product.gstRate || 18,
        image: item.product.images?.[0] || "",
      }));

      const subtotal = cart.items.reduce((sum, i) => sum + (i.product.salePrice || i.product.price) * i.quantity, 0);

      const paidPaise = Number(payment.amount) || 0;
      const expectedPaise = Math.round(subtotal * 100);
      if (Math.abs(paidPaise - expectedPaise) > 100) {
        console.error(`Webhook amount mismatch: paid ${paidPaise} paise vs expected ${expectedPaise} paise for user ${notes.userId}`);
        return res.json({ received: true });
      }

      const user = await User.findById(notes.userId);
      const savedAddr = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0];
      const shippingAddr = savedAddr
        ? {
            fullName: savedAddr.fullName,
            streetAddress: savedAddr.streetAddress,
            city: savedAddr.city,
            state: savedAddr.state,
            zipCode: savedAddr.zipCode,
            phoneNumber: savedAddr.phoneNumber,
          }
        : null;
      if (!shippingAddr) {
        console.error(`Webhook: no shipping address found for user ${notes.userId}`);
        return res.json({ received: true });
      }

      for (const item of cart.items) {
        if (item.product.stock < item.quantity) {
          console.error(`Webhook: insufficient stock for ${item.product.name}`);
          return res.json({ received: true });
        }
      }

      let newOrder;
      try {
        newOrder = await Order.create({
          user: notes.userId,
          orderNumber: await generateOrderNumber(Order),
          orderItems,
          shippingAddress: shippingAddr,
          totalPrice: subtotal,
          paymentResult: { id: payment.id, status: "captured" },
        });
      } catch (err) {
        if (err.code === 11000 && err.message?.includes("paymentResult.id")) {
          return res.json({ received: true });
        }
        throw err;
      }

      for (const item of cart.items) {
        await Product.findOneAndUpdate(
          { _id: item.product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );
      }

      await Cart.findOneAndUpdate({ user: notes.userId }, { $set: { items: [] } });
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

export async function placeOrder(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, cartItems, shippingAddress, totalPrice } = req.body;
    const user = req.user;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" });
    }
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart items required" });
    }

    const { razorpay, key_secret } = await getRazorpayInstance();

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", key_secret).update(body).digest("hex");
    const sigBuffer = Buffer.from(razorpay_signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    let rzpPayment;
    try {
      rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch {
      return res.status(400).json({ error: "Payment not found at Razorpay" });
    }
    if (rzpPayment.status !== "captured") {
      return res.status(400).json({ error: `Payment not captured (status: ${rzpPayment.status})` });
    }

    let subtotal = 0;
    const validatedItems = [];

    for (const item of cartItems) {
      const productId = item.productId || item.slug || item._id;
      if (!productId) {
        return res.status(400).json({ error: "Product ID missing from cart item" });
      }
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${productId}` });
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
      subtotal += price * quantity;
      validatedItems.push({
        product: product._id,
        name: product.name,
        price,
        quantity,
        gstRate: product.gstRate || 18,
        image: product.images?.[0] || "",
      });
    }

    const paidPaise = Number(rzpPayment.amount) || 0;
    const expectedPaise = Math.round(subtotal * 100);
    if (Math.abs(paidPaise - expectedPaise) > 100) {
      return res.status(400).json({ error: `Paid amount (₹${(paidPaise / 100).toFixed(2)}) does not match order total (₹${(expectedPaise / 100).toFixed(2)})` });
    }

    let order;
    try {
      order = await Order.create({
        user: user._id,
        orderNumber: await generateOrderNumber(Order),
        orderItems: validatedItems,
        shippingAddress: shippingAddress || {},
        totalPrice: subtotal,
        paymentResult: { id: razorpay_payment_id, status: "captured" },
      });
    } catch (err) {
      if (err.code === 11000 && err.message?.includes("paymentResult.id")) {
        const existing = await Order.findOne({ "paymentResult.id": razorpay_payment_id });
        if (existing) {
          return res.status(200).json({ message: "Order already placed", order: existing });
        }
      }
      throw err;
    }

    for (const item of validatedItems) {
      await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
    }

    await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [] } });

    res.status(201).json({ message: "Order placed successfully", order });

    if (user.email) {
      sendOrderConfirmation(order, user.email).catch(() => {});
    }
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
}
