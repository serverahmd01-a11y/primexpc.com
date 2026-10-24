import Razorpay from "razorpay";
import crypto from "crypto";
import { getRazorpayKeys } from "../models/setting.model.js";
import { sendOrderConfirmation } from "../config/email.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { User } from "../models/user.model.js";
import { generateOrderNumber } from "../utils/order.util.js";
import { sendOrderNotification, dispatchNotification, LOW_STOCK_THRESHOLD } from "../config/notify.js";
import { logger } from "../utils/logger.js";

async function getRazorpayInstance() {
  const keys = await getRazorpayKeys();
  const key_id = keys.key_id;
  const key_secret = keys.key_secret;
  if (!key_id || !key_secret) throw new Error("Razorpay keys not configured");
  return { razorpay: new Razorpay({ key_id, key_secret }), key_id, key_secret };
}

function hmacMatches(secret, expected, actual) {
  try {
    const a = Buffer.from(String(actual), "hex");
    const b = Buffer.from(String(expected), "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function expectedChargePaise(draft) {
  if (draft.paymentType === "cod") {
    return Math.round((draft.codAdvanceAmount || Math.round(draft.totalPrice * 0.25)) * 100);
  }
  return Math.round(draft.totalPrice * 100);
}

/**
 * Validate cart items against the live product DB BEFORE any payment happens.
 * Returns { error } with a user-facing message, or { items, subtotal }.
 * Every rejection is logged with the user + reason so admin can see exactly
 * which user hit which problem.
 */
async function buildValidatedItems(rawItems, user) {
  const logCtx = { userId: user._id?.toString(), email: user.email };

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    logger.order("WARN", "Checkout rejected - no items in request", logCtx);
    return { error: "Your cart is empty" };
  }

  const items = [];
  let subtotal = 0;

  for (const raw of rawItems) {
    const productId = raw?.productId || raw?.product || raw?._id;
    const quantity = Number.isInteger(Number(raw?.quantity)) && Number(raw?.quantity) > 0 ? Number(raw?.quantity) : 0;

    if (!productId) {
      logger.order("WARN", "Checkout rejected - product ID missing", { ...logCtx, item: raw?.name || raw?.productId });
      return { error: "Product ID missing from cart item" };
    }
    if (!quantity) {
      logger.order("WARN", "Checkout rejected - invalid quantity", { ...logCtx, productId: String(productId), sentQuantity: raw?.quantity });
      return { error: "Invalid quantity for a cart item" };
    }

    const product = await Product.findById(productId);
    if (!product) {
      logger.order("WARN", "Checkout rejected - product no longer exists", { ...logCtx, productId: String(productId) });
      return { error: `A product in your cart is no longer available. Please remove it and try again.` };
    }

    const price = Number(product.salePrice) || Number(product.price);
    if (!price || price <= 0) {
      logger.order("WARN", "Checkout rejected - product has no valid price", { ...logCtx, productId: String(productId), productName: product.name });
      return { error: `Product has no valid price: ${product.name}` };
    }

    if (product.stock < quantity) {
      logger.order("WARN", "Checkout rejected - insufficient stock (BEFORE payment)", {
        ...logCtx,
        productId: String(productId),
        productName: product.name,
        requested: quantity,
        stock: product.stock,
      });
      return {
        error:
          product.stock <= 0
            ? `Sorry, "${product.name}" just went out of stock. Please remove it from your cart to continue.`
            : `Insufficient stock: ${product.name} — only ${product.stock} left (you have ${quantity} in cart)`,
      };
    }

    subtotal += price * quantity;
    items.push({
      product: product._id,
      name: product.name,
      price,
      quantity,
      condition: product.condition || "new",
      gstRate: product.gstRate || 18,
      image: product.images?.[0] || "",
    });
  }

  return { items, subtotal };
}

/**
 * Turn a paid draft into a real order. Idempotent: only the first caller
 * (browser callback or webhook) wins the claim; later callers get the
 * finished order back. Assigns the order number, decrements stock
 * (never below zero), clears the cart and sends the confirmation email.
 */
export async function finalizeDraftOrder(draft, paymentId, statusWord, source) {
  const logCtx = {
    source,
    draftId: draft._id?.toString(),
    userId: draft.user?.toString(),
    paymentId,
    paymentType: draft.paymentType,
    total: draft.totalPrice,
  };

  const isCod = draft.paymentType === "cod";

  let claim;
  try {
    claim = await Order.findOneAndUpdate(
      { _id: draft._id, isDraft: true, "paymentResult.id": null },
      {
        $set: {
          isDraft: false,
          paymentResult: { id: paymentId, status: statusWord },
          ...(isCod ? { advancePaid: true } : { balancePaid: true, balancePaidAt: new Date() }),
        },
      },
      { new: true }
    );
  } catch (err) {
    // The unique index on paymentResult.id guards against double-finalize —
    // e.g. a legacy client created the order on the old endpoint and the
    // webhook then tries to finalize the draft with the same payment.
    if (err.code === 11000) {
      const existing = await Order.findOne({ "paymentResult.id": paymentId });
      logger.order("INFO", "Payment already recorded on another order - draft finalize skipped", { ...logCtx, existingOrderId: existing?._id?.toString() });
      return existing;
    }
    throw err;
  }

  if (!claim) {
    const existing = await Order.findById(draft._id);
    logger.order("INFO", "Order already finalized - idempotent skip", logCtx);
    return existing;
  }

  claim.orderNumber = await generateOrderNumber(Order);
  await claim.save();

  const stockShort = [];
  const lowStock = [];
  for (const item of claim.orderItems) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );
    if (!updated) {
      stockShort.push({ product: item.name, qty: item.quantity });
    } else if (updated.stock - item.quantity <= LOW_STOCK_THRESHOLD) {
      lowStock.push({ name: item.name, left: updated.stock - item.quantity });
    }
  }

  if (lowStock.length) {
    dispatchNotification("low_stock", {
      title: "⚠️ Low Stock Warning",
      lines: [
        ...lowStock.map((p) => `• ${p.name} — only ${p.left} left`),
        "",
        "Restock soon to avoid missed sales.",
      ],
    });
  }

  await Cart.findOneAndUpdate({ user: claim.user }, { $set: { items: [] } });

  const user = await User.findById(claim.user).select("email name");
  if (user?.email) {
    sendOrderConfirmation(claim, user.email).catch((e) => {
      logger.order("ERROR", "Failed to send confirmation email", { ...logCtx, error: e.message, email: user.email });
    });
  }

  // Owner notification (Telegram / WhatsApp / email) — fire-and-forget, never blocks the order.
  sendOrderNotification(claim, user, source);

  logger.order("SUCCESS", "Order created from draft", {
    ...logCtx,
    orderId: claim._id?.toString(),
    orderNumber: claim.orderNumber,
    email: user?.email,
    codAdvance: isCod ? claim.codAdvanceAmount : undefined,
    stockShort: stockShort.length ? stockShort : undefined,
    items: claim.orderItems.map((i) => ({ product: i.product.toString(), qty: i.quantity })),
  });

  return claim;
}

/**
 * Step 1 of checkout. Validates stock/price/product BEFORE any money moves,
 * saves a draft order (items + address snapshot) and creates the Razorpay
 * order. The draft is the single source of truth for the order — the browser
 * callback and the webhook only need to attach the payment to it.
 */
export async function createRazorpayOrder(req, res) {
  const user = req.user;
  let { paymentType, items, shippingAddress, receipt } = req.body;

  const logCtx = { userId: user._id?.toString(), email: user.email, paymentType };
  logger.payment("INFO", "Checkout started - create order request", logCtx);

  try {
    const isCod = paymentType === "cod";
    if (paymentType === "online") paymentType = "prepaid";
    if (!["cod", "prepaid"].includes(paymentType)) {
      logger.payment("WARN", "Checkout rejected - invalid payment type", logCtx);
      return res.status(400).json({ error: "Invalid payment method" });
    }

    // Legacy clients send no items — fall back to the server cart.
    if (!Array.isArray(items) || items.length === 0) {
      const cart = await Cart.findOne({ user: user._id }).populate("items.product");
      items = (cart?.items || [])
        .filter((i) => i.product)
        .map((i) => ({ productId: i.product._id || i.product, quantity: i.quantity }));
      if (items.length === 0) {
        logger.payment("WARN", "Checkout rejected - cart empty", logCtx);
        return res.status(400).json({ error: "Your cart is empty" });
      }
    }

    const addr = shippingAddress || {};
    const missingAddr = ["fullName", "streetAddress", "city", "state", "zipCode", "phoneNumber"].filter((k) => !String(addr[k] || "").trim());
    if (missingAddr.length) {
      logger.payment("WARN", "Checkout rejected - incomplete address", { ...logCtx, missingAddr });
      return res.status(400).json({ error: `Shipping address incomplete: ${missingAddr.join(", ")}` });
    }

    const { items: validatedItems, subtotal, error } = await buildValidatedItems(items, user);
    if (error) {
      return res.status(400).json({ error });
    }

    const chargePaise = isCod ? Math.round(subtotal * 0.25 * 100) : Math.round(subtotal * 100);

    const draft = await Order.create({
      user: user._id,
      orderItems: validatedItems,
      shippingAddress: {
        fullName: String(addr.fullName).trim(),
        streetAddress: String(addr.streetAddress).trim(),
        city: String(addr.city).trim(),
        state: String(addr.state).trim(),
        zipCode: String(addr.zipCode).trim(),
        phoneNumber: String(addr.phoneNumber).trim(),
      },
      totalPrice: subtotal,
      isDraft: true,
      paymentType: isCod ? "cod" : "prepaid",
      codAdvanceAmount: isCod ? Math.round(subtotal * 0.25) : 0,
    });

    const { razorpay, key_id } = await getRazorpayInstance();

    const rzpOrder = await razorpay.orders.create({
      amount: chargePaise,
      currency: "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        email: user.email || "",
        draftOrderId: draft._id.toString(),
        paymentType: isCod ? "cod" : "prepaid",
        expectedAmountPaise: String(chargePaise),
      },
    });

    await Order.updateOne({ _id: draft._id }, { $set: { razorpayOrderId: rzpOrder.id } });

    logger.payment("INFO", "Draft order + Razorpay order created", {
      ...logCtx,
      draftId: draft._id.toString(),
      razorpayOrderId: rzpOrder.id,
      subtotal,
      chargePaise,
      items: validatedItems.map((i) => ({ product: i.product.toString(), qty: i.quantity })),
    });

    res.status(200).json({
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: key_id,
      isCod,
      advanceAmount: isCod ? Math.round(subtotal * 0.25) : subtotal,
    });
  } catch (error) {
    logger.payment("ERROR", "Failed to create Razorpay order", { ...logCtx, error: error.message, stack: error.stack });
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: error.message || "Failed to create payment order" });
  }
}

/**
 * Step 2 of checkout (browser path, runs in the Razorpay success handler).
 * Finds the draft by razorpay_order_id, verifies the payment against the
 * Razorpay API (authoritative) and finalizes the draft.
 */
export async function placeOrder(req, res) {
  const user = req.user;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const logCtx = {
    userId: user._id?.toString(),
    email: user.email,
    razorpayOrderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
  };

  try {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      logger.order("WARN", "Place order rejected - missing verification data", logCtx);
      return res.status(400).json({ error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" });
    }

    const draft = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!draft) {
      logger.order("ERROR", "Place order failed - no draft found for this Razorpay order (webhook may recover it)", logCtx);
      return res.status(400).json({
        error: `Order session not found for this payment. Your payment is safe — it will be confirmed automatically, or contact support with payment ID ${razorpay_payment_id}.`,
      });
    }

    if (draft.user.toString() !== user._id.toString()) {
      logger.order("WARN", "Place order rejected - draft belongs to another user", logCtx);
      return res.status(403).json({ error: "This payment does not belong to your account" });
    }

    if (!draft.isDraft && draft.paymentResult?.id) {
      logger.order("INFO", "Place order - order already finalized, returning it", logCtx);
      return res.status(200).json({ message: "Order already placed", order: draft });
    }

    const { razorpay, key_secret } = await getRazorpayInstance();

    const expectedSig = crypto.createHmac("sha256", key_secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const signatureOk = hmacMatches(key_secret, expectedSig, razorpay_signature);
    if (!signatureOk) {
      // Signature can fail if keys were rotated between checkout and payment.
      // The Razorpay API fetch below is authoritative, so we only log this.
      logger.payment("WARN", "Payment signature mismatch - verifying via Razorpay API instead (keys may have been rotated)", logCtx);
    }

    let rzpPayment;
    try {
      rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch {
      logger.order("ERROR", "Place order failed - payment not found at Razorpay", logCtx);
      return res.status(400).json({ error: "Payment not found at Razorpay" });
    }

    if (rzpPayment.order_id !== razorpay_order_id) {
      logger.order("ERROR", "Place order failed - payment belongs to a different Razorpay order", { ...logCtx, actualOrderId: rzpPayment.order_id });
      return res.status(400).json({ error: "Payment does not match this order session" });
    }
    if (rzpPayment.status !== "captured") {
      logger.order("WARN", "Place order rejected - payment not captured", { ...logCtx, status: rzpPayment.status });
      return res.status(400).json({ error: `Payment not captured (status: ${rzpPayment.status})` });
    }

    const paidPaise = Number(rzpPayment.amount) || 0;
    const expectedPaise = expectedChargePaise(draft);
    if (Math.abs(paidPaise - expectedPaise) > 100) {
      logger.order("ERROR", "Place order failed - paid amount does not match draft", {
        ...logCtx,
        paidPaise,
        expectedPaise,
        draftTotal: draft.totalPrice,
        paymentType: draft.paymentType,
      });
      return res.status(400).json({
        error: `Paid amount (₹${(paidPaise / 100).toFixed(2)}) does not match order total (₹${(expectedPaise / 100).toFixed(2)}). Contact support with payment ID ${razorpay_payment_id}.`,
      });
    }

    const order = await finalizeDraftOrder(draft, razorpay_payment_id, draft.paymentType === "cod" ? "cod_advance" : "captured", "place-order");
    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    logger.order("FATAL", "Place order crashed", { ...logCtx, error: error.message, stack: error.stack });
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order. If you were charged, the order will be confirmed automatically — or contact support." });
  }
}

/**
 * Safety net (server path). Razorpay calls this on payment.captured. It finds
 * the draft by notes/order_id — NOT the cart — so it works even if the user
 * closed the browser right after paying, and for COD (25% advance) orders too.
 */
export async function handleWebhook(req, res) {
  try {
    const { webhook_secret } = await getRazorpayKeys();
    if (!webhook_secret) {
      logger.payment("ERROR", "Webhook rejected - webhook secret not configured in settings", {});
      console.error("Razorpay webhook secret not configured - rejecting webhook");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      logger.payment("WARN", "Webhook rejected - missing signature", {});
      return res.status(400).json({ error: "Missing webhook signature" });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto.createHmac("sha256", webhook_secret).update(rawBody).digest("hex");
    if (!hmacMatches(webhook_secret, expectedSignature, signature)) {
      logger.payment("WARN", "Webhook rejected - invalid signature", {});
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};
      const logCtx = {
        webhookEvent: event.event,
        paymentId: payment.id,
        razorpayOrderId: payment.order_id,
        draftOrderId: notes.draftOrderId,
        userId: notes.userId,
        email: notes.email,
        amountPaise: payment.amount,
      };

      let draft = notes.draftOrderId ? await Order.findById(notes.draftOrderId) : null;
      if (!draft && payment.order_id) {
        draft = await Order.findOne({ razorpayOrderId: payment.order_id });
      }

      if (!draft) {
        logger.order("ERROR", "Webhook: payment captured but NO draft order found - use admin Missed Orders tool to record it manually", logCtx);
        dispatchNotification("missed_payment", {
          title: "🚨 Payment received but NO order was created!",
          lines: [
            `Payment ID: ${payment.id}`,
            `Razorpay Order: ${payment.order_id || "-"}`,
            `Amount: ₹${((Number(payment.amount) || 0) / 100).toLocaleString("en-IN")}`,
            `User: ${notes.email || notes.userId || "unknown"}`,
            "",
            "Action needed: Admin → Missed Orders → create the order manually.",
          ],
        });
        return res.json({ received: true });
      }

      if (!draft.isDraft && draft.paymentResult?.id) {
        logger.order("INFO", "Webhook: draft already finalized - nothing to do", logCtx);
        return res.json({ received: true });
      }

      const paidPaise = Number(payment.amount) || 0;
      const expectedPaise = expectedChargePaise(draft);
      if (Math.abs(paidPaise - expectedPaise) > 100) {
        logger.order("ERROR", "Webhook: paid amount does not match draft - order NOT created, needs manual review", {
          ...logCtx,
          expectedPaise,
          draftTotal: draft.totalPrice,
          paymentType: draft.paymentType,
        });
        dispatchNotification("missed_payment", {
          title: "🚨 Payment amount mismatch — order NOT created",
          lines: [
            `Payment ID: ${payment.id}`,
            `Paid: ₹${(paidPaise / 100).toLocaleString("en-IN")} vs expected ₹${(expectedPaise / 100).toLocaleString("en-IN")}`,
            `User: ${notes.email || notes.userId || "unknown"}`,
            "",
            "Action needed: check Admin → Logs and Missed Orders.",
          ],
        });
        return res.json({ received: true });
      }

      await finalizeDraftOrder(draft, payment.id, draft.paymentType === "cod" ? "cod_advance" : "captured", "webhook");
    }

    res.json({ received: true });
  } catch (error) {
    logger.payment("FATAL", "Webhook processing crashed", { error: error.message, stack: error.stack });
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

export async function verifyRazorpayPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification data" });
    }

    const { key_secret } = await getRazorpayKeys();
    const expected = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const verified = hmacMatches(key_secret, expected, razorpay_signature);

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
