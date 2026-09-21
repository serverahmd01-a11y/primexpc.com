import nodemailer from "nodemailer";
import { getSetting } from "../models/setting.model.js";

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function createTransporter() {
  const host = await getSetting("smtp_host", process.env.SMTP_HOST || "");
  const port = parseInt(await getSetting("smtp_port", process.env.SMTP_PORT || "587"));
  const user = await getSetting("smtp_user", process.env.SMTP_USER || "");
  const pass = await getSetting("smtp_pass", process.env.SMTP_PASS || "");

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail({ to, subject, html }) {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      console.log("Email not configured, skipping:", subject);
      return null;
    }

    const fromName = await getSetting("email_from_name", "PrimeX PC");
    const fromEmail = await getSetting("email_from_address", "primexpc@gmail.com");
    const from = `"${fromName}" <${fromEmail}>`;

    const info = await transporter.sendMail({ from, to, subject, html });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email send failed:", error.message);
    return null;
  }
}

export async function sendOrderConfirmation(order, userEmail) {
  const itemsHtml = (order.orderItems || [])
    .map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #333">${escapeHtml(item.name)}</td><td style="padding:8px;border-bottom:1px solid #333;text-align:center">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #333;text-align:right">₹${item.price.toLocaleString("en-IN")}</td></tr>`)
    .join("");

  return sendEmail({
    to: userEmail,
    subject: `Order Confirmed #${order._id.toString().slice(-8).toUpperCase()} - PrimeX PC`,
    html: `
      <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#121212;color:#e0e0e0;border-radius:12px;overflow:hidden;border:1px solid #333">
        <div style="background:#10b981;padding:24px;text-align:center">
          <h1 style="margin:0;color:#121212;font-size:24px">Order Confirmed!</h1>
          <p style="margin:4px 0 0;color:#121212;font-size:14px">Order #${order._id.toString().slice(-8).toUpperCase()}</p>
        </div>
        <div style="padding:24px">
          <p>Hi ${escapeHtml(order.shippingAddress?.fullName || "Customer")},</p>
          <p>Your order has been confirmed and is being processed. Here are the details:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#1a1a1a"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Price</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="text-align:right;font-size:20px;font-weight:bold;color:#10b981;margin:16px 0">Total: ₹${order.totalPrice.toLocaleString("en-IN")}</div>
          <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:16px 0">
            <p style="margin:0;font-weight:bold;color:#10b981">Shipping Address</p>
            <p style="margin:4px 0">${escapeHtml(order.shippingAddress?.fullName || "")}</p>
            <p style="margin:4px 0">${escapeHtml(order.shippingAddress?.streetAddress || "")}</p>
            <p style="margin:4px 0">${escapeHtml(order.shippingAddress?.city || "")}, ${escapeHtml(order.shippingAddress?.state || "")} - ${escapeHtml(order.shippingAddress?.zipCode || "")}</p>
          </div>
          <p style="font-size:12px;color:#888">You'll receive tracking updates once your order ships.</p>
        </div>
        <div style="background:#1a1a1a;padding:16px;text-align:center;font-size:12px;color:#666">
          © ${new Date().getFullYear()} PrimeX Technologies. All rights reserved.
        </div>
      </div>
    `,
  });
}

export async function sendShipmentTracking(order, userEmail) {
  return sendEmail({
    to: userEmail,
    subject: `Your Order Has Shipped! #${order._id.toString().slice(-8).toUpperCase()} - PrimeX PC`,
    html: `
      <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#121212;color:#e0e0e0;border-radius:12px;overflow:hidden;border:1px solid #333">
        <div style="background:#3b82f6;padding:24px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:24px">Shipped!</h1>
          <p style="margin:4px 0 0;color:#fff;font-size:14px">Your order is on the way</p>
        </div>
        <div style="padding:24px">
          <p>Hi ${order.shippingAddress?.fullName || "Customer"},</p>
          <p>Great news! Your order <b>#${order._id.toString().slice(-8).toUpperCase()}</b> has been shipped.</p>
          ${order.shiprocket_awb ? `<div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:16px 0"><p style="margin:0;font-size:14px"><b>Tracking AWB:</b> <span style="color:#10b981;font-family:monospace">${order.shiprocket_awb}</span></p></div>` : ""}
          <p style="font-size:12px;color:#888">Track your shipment using the AWB number above on your courier's website.</p>
        </div>
        <div style="background:#1a1a1a;padding:16px;text-align:center;font-size:12px;color:#666">
          © ${new Date().getFullYear()} PrimeX Technologies. All rights reserved.
        </div>
      </div>
    `,
  });
}

export async function sendOrderDelivered(order, userEmail) {
  return sendEmail({
    to: userEmail,
    subject: `Order Delivered! #${order._id.toString().slice(-8).toUpperCase()} - PrimeX PC`,
    html: `
      <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#121212;color:#e0e0e0;border-radius:12px;overflow:hidden;border:1px solid #333">
        <div style="background:#10b981;padding:24px;text-align:center">
          <h1 style="margin:0;color:#121212;font-size:24px">Delivered!</h1>
          <p style="margin:4px 0 0;color:#121212;font-size:14px">Enjoy your new gear</p>
        </div>
        <div style="padding:24px">
          <p>Hi ${order.shippingAddress?.fullName || "Customer"},</p>
          <p>Your order <b>#${order._id.toString().slice(-8).toUpperCase()}</b> has been delivered. We hope you love your new setup!</p>
          <p style="font-size:12px;color:#888">Questions? Reply to this email or contact support.</p>
        </div>
        <div style="background:#1a1a1a;padding:16px;text-align:center;font-size:12px;color:#666">
          © ${new Date().getFullYear()} PrimeX Technologies. All rights reserved.
        </div>
      </div>
    `,
  });
}

export async function sendTestEmail(to) {
  return sendEmail({
    to,
    subject: "Test Email - PrimeX PC",
    html: `<div style="max-width:600px;margin:auto;font-family:Arial;background:#121212;color:#e0e0e0;padding:24px;border-radius:12px;border:1px solid #333"><h2 style="color:#10b981">PrimeX PC</h2><p>This is a test email to verify your email configuration.</p></div>`,
  });
}

export async function sendSellNotification(lead, event) {
  const CONDITION_LABELS = {
    perfectly_working: "Perfectly Working",
    minor_issue: "Minor Issue",
    needs_repair: "Needs Repair",
    dead: "Dead / Not Working",
  };

  const firstProduct = lead.products?.[0] || {};
  const productList = (lead.products || []).map((p) => `<li>${p.brand} ${p.model} (${p.category}) - ${CONDITION_LABELS[p.condition] || p.condition}</li>`).join("");
  const productInfo = lead.products?.length > 1
    ? `<p><b>Products (${lead.products.length}):</b></p><ul>${productList}</ul>`
    : `<p><b>Product:</b> ${firstProduct.brand} ${firstProduct.model}</p><p>${firstProduct.category} | ${CONDITION_LABELS[firstProduct.condition] || firstProduct.condition}</p>`;

  const eventConfig = {
    submission_received: {
      subject: `Submission Received - Selling ${firstProduct.category || 'Hardware'} - PrimeX PC`,
      title: "Submission Received!",
      body: `<p>Hi ${lead.customerName},</p><p>We have received your submission to sell ${lead.products?.length || 0} item(s).</p>${productInfo}<div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:16px 0"><p style="margin:0;font-size:14px"><b>Reference ID:</b> <span style="color:#10b981;font-family:monospace">${lead._id.toString().slice(-8).toUpperCase()}</span></p><p style="margin:4px 0 0;font-size:14px"><b>Expected Total:</b> ${lead.declaredValue ? '₹' + lead.declaredValue.toLocaleString("en-IN") : 'N/A'}</p></div>`,
    },
    quote_ready: {
      subject: `Quote Ready - PrimeX PC`,
      title: "Quote Ready!",
      body: `<p>Hi ${lead.customerName},</p><p>We have reviewed your ${lead.products?.length || 0} item(s) and are pleased to offer:</p><div style="text-align:center;margin:24px 0"><span style="font-size:32px;font-weight:bold;color:#10b981">₹${(lead.offeredPrice || 0).toLocaleString("en-IN")}</span></div>${productInfo}<p>Please visit our portal to accept or reject this offer.</p>`,
    },
    pickup_scheduled: {
      subject: `Pickup Scheduled - PrimeX PC`,
      title: "Pickup Scheduled!",
      body: `<p>Hi ${lead.customerName},</p><p>Your pickup has been scheduled for ${lead.products?.length || 0} item(s)!</p>${lead.awbNumber ? `<div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:16px 0"><p style="margin:0"><b>AWB Number:</b> <span style="color:#10b981;font-family:monospace">${lead.awbNumber}</span></p><p style="margin:4px 0 0"><b>Courier:</b> ${lead.courierName || 'TBD'}</p>${lead.trackingUrl ? `<p style="margin:4px 0 0"><b>Track:</b> <a href="${lead.trackingUrl}" style="color:#3b82f6">Click here</a></p>` : ""}</div>` : ""}`,
    },
    picked_up: {
      subject: `Package Picked Up - PrimeX PC`,
      title: "Package Picked Up!",
      body: `<p>Hi ${lead.customerName},</p><p>Your package has been picked up and is on its way to our facility.</p>${lead.awbNumber ? `<p>Track with AWB: <b style="color:#10b981">${lead.awbNumber}</b></p>` : ""}`,
    },
    received: {
      subject: `Hardware Received - PrimeX PC`,
      title: "Hardware Received!",
      body: `<p>Hi ${lead.customerName},</p><p>We have received your hardware at our facility. Our team will now test the items.</p>${productInfo}`,
    },
    testing_started: {
      subject: `Testing Started - PrimeX PC`,
      title: "Testing Started!",
      body: `<p>Hi ${lead.customerName},</p><p>We have started testing your ${lead.products?.length || 0} item(s). We will update you once testing is complete.</p>`,
    },
    payment_sent: {
      subject: `Payment Sent - PrimeX PC`,
      title: "Payment Sent!",
      body: `<p>Hi ${lead.customerName},</p><p>Payment of <b style="color:#10b981">₹${(lead.offeredPrice || 0).toLocaleString("en-IN")}</b> has been sent for your ${lead.products?.length || 0} item(s).</p><p>The amount will reflect in your account shortly.</p>`,
    },
    completed: {
      subject: `Order Completed - PrimeX PC`,
      title: "Thank You!",
      body: `<p>Hi ${lead.customerName},</p><p>Your sell order for ${lead.products?.length || 0} item(s) has been completed. Thank you for choosing PrimeX PC!</p>`,
    },
  };

  const config = eventConfig[event];
  if (!config) return null;

  return sendEmail({
    to: lead.customerEmail,
    subject: config.subject,
    html: `
      <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#121212;color:#e0e0e0;border-radius:12px;overflow:hidden;border:1px solid #333">
        <div style="background:#10b981;padding:24px;text-align:center">
          <h1 style="margin:0;color:#121212;font-size:24px">${config.title}</h1>
          <p style="margin:4px 0 0;color:#121212;font-size:14px">Ref: ${lead._id.toString().slice(-8).toUpperCase()}</p>
        </div>
        <div style="padding:24px">
          ${config.body}
        </div>
        <div style="background:#1a1a1a;padding:16px;text-align:center;font-size:12px;color:#666">
          2026 PrimeX Technologies. All rights reserved.
        </div>
      </div>
    `,
  });
}
