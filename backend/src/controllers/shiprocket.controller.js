import { Order } from "../models/order.model.js";
import {
  createShiprocketOrder,
  trackShipment,
  generateLabel,
} from "../config/shiprocket.js";
import { getSetting } from "../models/setting.model.js";

function fail(res, err, msg = "Shiprocket API failed") {
  console.error("Shiprocket error:", err.message);
  res.status(500).json({ error: err.message || msg });
}

export async function shipOrder(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("user", "email name");

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.shiprocket_shipment_id) {
      return res.status(400).json({ error: "Shipment already created for this order" });
    }

    const result = await createShiprocketOrder(order);
    const shipmentId = result.shipment_id || result.id;

    if (!shipmentId) {
      return res.status(500).json({ error: "No shipment_id in Shiprocket response", raw: result });
    }

    order.shiprocket_shipment_id = shipmentId;
    order.shiprocket_order_id = result.order_id || "";
    order.shiprocket_courier_id = result.courier_company_id || "";
    order.shiprocket_courier_name = result.courier_name || "";
    order.shiprocket_awb = result.awb_code || "";

    if (order.status === "pending") {
      order.status = "shipped";
      order.shippedAt = new Date();
    }

    await order.save();

    res.json({
      message: "Shipment created",
      shipment_id: shipmentId,
      awb: order.shiprocket_awb,
      courier: order.shiprocket_courier_name,
    });
  } catch (err) {
    fail(res, err);
  }
}

export async function trackByAWB(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order?.shiprocket_awb) return res.status(404).json({ error: "No AWB for this order" });
    const data = await trackShipment(order.shiprocket_awb);
    res.json(data);
  } catch (err) {
    fail(res, err);
  }
}

export async function generateLabelForOrder(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order?.shiprocket_shipment_id) {
      return res.status(400).json({ error: "No shipment found" });
    }
    const raw = await generateLabel([order.shiprocket_shipment_id]);
    if (Buffer.isBuffer(raw)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="label-${order.shiprocket_shipment_id}.pdf"`);
      return res.send(raw);
    }
    res.json(raw);
  } catch (err) {
    fail(res, err);
  }
}

export async function cancelOrderShipment(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order?.shiprocket_shipment_id) {
      return res.status(400).json({ error: "No shipment found" });
    }

    order.shiprocket_shipment_id = "";
    order.shiprocket_order_id = "";
    order.shiprocket_awb = "";
    order.shiprocket_courier_id = "";
    order.shiprocket_courier_name = "";

    if (order.status === "shipped") {
      order.status = "pending";
      order.shippedAt = undefined;
    }

    await order.save();
    res.json({ message: "Shipment cancelled locally", orderId });
  } catch (err) {
    fail(res, err);
  }
}

export async function adminListShiprocketOrders(req, res) {
  try {
    const orders = await Order.find({
      shiprocket_shipment_id: { $nin: [null, ""] },
    })
      .populate("user", "email name")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(orders);
  } catch (err) {
    fail(res, err);
  }
}
