import { getSetting } from "../models/setting.model.js";

const BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiry = 0;

async function getShiprocketCredentials() {
  const email = await getSetting("shiprocket_email", process.env.SHIPROCKET_EMAIL || "");
  const password = await getSetting("shiprocket_password", process.env.SHIPROCKET_PASSWORD || "");
  return { email, password };
}

async function fetchToken() {
  const { email, password } = await getShiprocketCredentials();
  if (!email || !password) throw new Error("Shiprocket credentials not configured");

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.token) throw new Error(data.message || "Shiprocket auth failed");

  cachedToken = data.token;
  tokenExpiry = Date.now() + 10 * 24 * 60 * 60 * 1000;
  return data.token;
}

export async function getShiprocketToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  return fetchToken();
}

async function srFetch(path, options = {}, retried = false) {
  let headers = await authHeaders();
  headers = { ...headers, ...(options.headers || {}) };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && !retried) {
    cachedToken = null;
    tokenExpiry = 0;
    return srFetch(path, options, true);
  }
  return res;
}

export async function authHeaders() {
  const token = await getShiprocketToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function createShiprocketOrder(order) {
  const items = (order.orderItems || []).map((item) => ({
    name: item.name,
    sku: item.product?.toString() || "SKU-" + item.name?.slice(0, 6),
    units: item.quantity,
    selling_price: item.price,
  }));

  const isCod = order.paymentResult?.status === "cod_advance";
  const body = {
    order_id: order._id.toString(),
    order_date: (order.createdAt || new Date()).toISOString().split("T")[0],
    pickup_location: "Primary",
    channel_id: "",
    billing_customer_name: order.shippingAddress?.fullName || "",
    billing_last_name: "",
    billing_address: order.shippingAddress?.streetAddress || "",
    billing_address_2: "",
    billing_city: order.shippingAddress?.city || "",
    billing_pincode: order.shippingAddress?.zipCode || "",
    billing_state: order.shippingAddress?.state || "",
    billing_country: "India",
    billing_email: order.user?.email || "",
    billing_phone: order.shippingAddress?.phoneNumber || "",
    shipping_is_billing: true,
    order_items: items,
    payment_method: isCod ? "COD" : "Prepaid",
    cod_amount: isCod ? order.totalPrice : undefined,
    sub_total: order.totalPrice,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  };

  const res = await srFetch("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Shiprocket order creation failed");
  return data;
}

export async function trackShipment(awb) {
  const res = await srFetch(`/courier/track/awb/${awb}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Shiprocket track failed");
  return data;
}

export async function generateLabel(shipmentIds) {
  const res = await srFetch("/courier/generate/label", {
    method: "POST",
    body: JSON.stringify({ shipment_id: shipmentIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Shiprocket label generation failed");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/pdf")) return Buffer.from(await res.arrayBuffer());
  return res.json();
}

export async function createPickupOrder(sellLead) {
  const body = {
    order_id: `SELL-${sellLead._id.toString().slice(-6).toUpperCase()}`,
    order_date: new Date().toISOString().split("T")[0],
    pickup_location: "Primary",
    channel_id: "",
    billing_customer_name: sellLead.customerName,
    billing_last_name: "",
    billing_address: sellLead.pickupAddress || sellLead.customerAddress,
    billing_address_2: "",
    billing_city: sellLead.customerCity,
    billing_pincode: sellLead.customerPincode,
    billing_state: sellLead.customerState,
    billing_country: "India",
    billing_email: sellLead.customerEmail,
    billing_phone: sellLead.customerMobile,
    shipping_is_billing: true,
    order_items: [
      {
        name: `${sellLead.brand} ${sellLead.model} (${sellLead.category})`,
        sku: `SELL-${sellLead._id.toString().slice(-8).toUpperCase()}`,
        units: 1,
        selling_price: sellLead.declaredValue || sellLead.offeredPrice || sellLead.expectedPrice || 1000,
      },
    ],
    payment_method: "Prepaid",
    sub_total: sellLead.declaredValue || sellLead.offeredPrice || sellLead.expectedPrice || 1000,
    length: sellLead.packageLength || 30,
    breadth: sellLead.packageBreadth || 30,
    height: sellLead.packageHeight || 30,
    weight: sellLead.packageWeight || 1,
  };

  const res = await srFetch("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Shiprocket pickup order creation failed");
  return data;
}

export async function trackPickup(awb) {
  const res = await srFetch(`/courier/track/awb/${awb}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Shiprocket track failed");
  return data;
}

export async function generatePickupLabel(shipmentIds) {
  const res = await srFetch("/courier/generate/label", {
    method: "POST",
    body: JSON.stringify({ shipment_id: shipmentIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Shiprocket label generation failed");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/pdf")) return Buffer.from(await res.arrayBuffer());
  return res.json();
}
