import { SellLead } from "../models/sellLead.model.js";
import { SellProduct } from "../models/sellProduct.model.js";
import { SellCategory } from "../models/sellCategory.model.js";
import { SellBrand } from "../models/sellBrand.model.js";
import { SellModel } from "../models/sellModel.model.js";
import { sendEmail, sendSellNotification } from "../config/email.js";
import { createPickupOrder, trackPickup, generatePickupLabel } from "../config/shiprocket.js";
import crypto from "crypto";

const otpStore = new Map();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOTP(req, res) {
  try {
    const { mobile } = req.body;
    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ message: "Valid mobile number required" });
    }
    const otp = generateOTP();
    const expiry = Date.now() + 5 * 60 * 1000;
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    otpStore.set(mobile, { hashedOtp, expiry });
    console.log(`OTP for ${mobile}: ${otp}`);
    res.status(200).json({ message: "OTP sent successfully", expiresAt: expiry });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP" });
  }
}

export async function verifyOTP(req, res) {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ message: "Mobile and OTP required" });
    }
    const stored = otpStore.get(mobile);
    if (!stored) {
      return res.status(400).json({ message: "OTP not found or expired" });
    }
    if (Date.now() > stored.expiry) {
      otpStore.delete(mobile);
      return res.status(400).json({ message: "OTP expired" });
    }
    const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedInput !== stored.hashedOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    otpStore.delete(mobile);
    res.status(200).json({ message: "OTP verified", verified: true });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed" });
  }
}

export async function uploadSellFile(req, res, next) {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const fileArray = Array.isArray(req.files) ? req.files : [req.files];
    const urls = fileArray.map((f) => ({
      url: `/uploads/${f.filename}`,
      originalName: f.originalname || f.originalName,
      size: f.size || 0,
    }));
    res.status(200).json({ files: urls });
  } catch (error) {
    console.error("Upload sell file error:", error.message, error.stack);
    res.status(500).json({ message: "File upload failed: " + error.message });
  }
}

export async function submitLead(req, res) {
  try {
    const {
      customerName, customerMobile, customerEmail,
      customerAddress, customerCity, customerState, customerPincode,
      gstNumber, products, photos, videos,
      pickupAddress, preferredPickupDate, preferredTimeSlot,
    } = req.body;

    if (!customerName || !customerMobile || !customerEmail || !customerAddress || !customerCity || !customerState || !customerPincode) {
      return res.status(400).json({ message: "All customer details are required" });
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "At least one product is required" });
    }
    for (const prod of products) {
      if (!prod.category || !prod.brand || !prod.model || !prod.condition) {
        return res.status(400).json({ message: "Each product needs category, brand, model, and condition" });
      }
    }

    if (!photos || !Array.isArray(photos) || photos.length < 4) {
      return res.status(400).json({ message: "Minimum 4 photos required" });
    }
    if (!videos || !Array.isArray(videos) || videos.length < 1) {
      return res.status(400).json({ message: "Minimum 1 video required" });
    }

    const validPhotos = photos.filter((p) => p.url && p.url.trim() !== "");
    const validVideos = videos.filter((v) => v.url && v.url.trim() !== "");
    if (validPhotos.length < 4) {
      return res.status(400).json({ message: `At least 4 photos with valid URLs required (got ${validPhotos.length})` });
    }
    if (validVideos.length < 1) {
      return res.status(400).json({ message: "At least 1 video with valid URL required" });
    }

    const firstProduct = products[0];
    const existing = await SellLead.findOne({
      customerMobile,
      "products.category": firstProduct.category,
      "products.model": firstProduct.model,
      status: { $nin: ["completed", "cancelled", "rejected"] },
    });
    if (existing) {
      return res.status(400).json({ message: "You already have an active lead with this product" });
    }

    const totalExpected = products.reduce((sum, p) => sum + (p.expectedPrice || 0), 0);

    const lead = await SellLead.create({
      customerName,
      customerMobile,
      customerEmail,
      customerAddress,
      customerCity,
      customerState,
      customerPincode,
      gstNumber: gstNumber || "",
      isOtpVerified: true,
      products,
      photos: photos || [],
      videos: videos || [],
      pickupAddress: pickupAddress || customerAddress,
      preferredPickupDate: preferredPickupDate || null,
      preferredTimeSlot: preferredTimeSlot || "",
      status: "new",
      declaredValue: totalExpected || 0,
    });

    await sendSellNotification(lead, "submission_received");

    res.status(201).json({ message: "Lead submitted successfully", leadId: lead._id, lead });
  } catch (error) {
    console.error("Submit lead error:", error.message);
    if (error.errors) {
      const messages = Object.values(error.errors).map((e) => e.message).join(", ");
      return res.status(400).json({ message: "Validation failed: " + messages });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate submission detected" });
    }
    res.status(500).json({ message: "Failed to submit lead: " + error.message });
  }
}

export async function getMyLeads(req, res) {
  try {
    const { mobile } = req.query;
    if (!mobile) {
      return res.status(400).json({ message: "Mobile number required" });
    }
    const isStaff = req.user && ["admin", "ca", "shipping"].includes(req.user.role);
    if (isStaff) {
      const leads = await SellLead.find({ customerMobile: mobile }).sort({ createdAt: -1 });
      return res.status(200).json(leads);
    }
    if (!req.user?.email) {
      return res.status(403).json({ message: "Login required to view leads" });
    }
    const leads = await SellLead.find({ customerMobile: mobile, customerEmail: req.user.email }).sort({ createdAt: -1 });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leads" });
  }
}

export async function getMyLeadsByUser(req, res) {
  try {
    const email = req.user?.email;
    if (!email) return res.status(400).json({ message: "User email not found" });
    const leads = await SellLead.find({ customerEmail: email }).sort({ createdAt: -1 });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leads" });
  }
}

export async function getAllLeads(req, res) {
  try {
    const { status } = req.query;
    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    const leads = await SellLead.find(query).sort({ createdAt: -1 });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leads" });
  }
}

export async function getLeadById(req, res) {
  try {
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const isStaff = req.user && ["admin", "ca", "shipping"].includes(req.user.role);
    if (!isStaff && req.user && req.user.email !== lead.customerEmail) {
      return res.status(403).json({ message: "Not authorized to view this lead" });
    }
    if (!isStaff && !req.user) {
      return res.status(403).json({ message: "Not authorized to view this lead" });
    }
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch lead" });
  }
}

export async function updateLeadStatus(req, res) {
  try {
    const { status, note } = req.body;
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const validTransitions = {
      new: ["contacted", "price_offered", "cancelled"],
      contacted: ["price_offered", "cancelled"],
      price_offered: ["accepted", "rejected", "cancelled"],
      accepted: ["pickup_scheduled", "cancelled"],
      rejected: ["cancelled"],
      pickup_scheduled: ["picked_up", "cancelled"],
      picked_up: ["in_transit"],
      in_transit: ["received"],
      received: ["testing"],
      testing: ["payment_pending", "completed"],
      payment_pending: ["paid"],
      paid: ["completed"],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[lead.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from ${lead.status} to ${status}` });
    }

    lead.status = status;
    if (note) {
      lead.adminNotes.push({ text: note });
    }

    await lead.save();

    const notificationEvents = {
      price_offered: "quote_ready",
      pickup_scheduled: "pickup_scheduled",
      picked_up: "picked_up",
      received: "received",
      testing: "testing_started",
      paid: "payment_sent",
      completed: "completed",
    };

    if (notificationEvents[status]) {
      await sendSellNotification(lead, notificationEvents[status]);
    }

    res.status(200).json({ message: "Status updated", lead });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
}

export async function offerPrice(req, res) {
  try {
    const { offeredPrice, note } = req.body;
    if (!offeredPrice || offeredPrice <= 0) {
      return res.status(400).json({ message: "Valid price required" });
    }
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    lead.offeredPrice = offeredPrice;
    lead.status = "price_offered";
    if (note) {
      lead.adminNotes.push({ text: `Price offered: ₹${offeredPrice.toLocaleString("en-IN")} - ${note}` });
    }
    lead.declaredValue = offeredPrice;

    await lead.save();
    await sendSellNotification(lead, "quote_ready");

    res.status(200).json({ message: "Price offered", lead });
  } catch (error) {
    console.error("Offer price error:", error);
    res.status(500).json({ message: "Failed to offer price" });
  }
}

export async function addAdminNote(req, res) {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: "Note required" });
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    lead.adminNotes.push({ text: note });
    await lead.save();
    res.status(200).json({ message: "Note added", lead });
  } catch (error) {
    res.status(500).json({ message: "Failed to add note" });
  }
}

export async function schedulePickup(req, res) {
  try {
    const { packageWeight, packageLength, packageBreadth, packageHeight } = req.body;
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (lead.status !== "accepted") {
      return res.status(400).json({ message: "Lead must be accepted before pickup" });
    }

    if (packageWeight) lead.packageWeight = packageWeight;
    if (packageLength) lead.packageLength = packageLength;
    if (packageBreadth) lead.packageBreadth = packageBreadth;
    if (packageHeight) lead.packageHeight = packageHeight;

    try {
      const shiprocketResult = await createPickupOrder(lead);
      lead.shiprocketOrderId = shiprocketResult.order_id?.toString() || "";
      lead.shiprocketShipmentId = shiprocketResult.shipment_id?.toString() || "";
      lead.awbNumber = shiprocketResult.awb_code || shiprocketResult.awb_number || "";
      lead.courierName = shiprocketResult.courier_name || "";
      lead.trackingUrl = shiprocketResult.tracking_url || `https://shiprocket.co/tracking/${lead.awbNumber}`;
      lead.status = "pickup_scheduled";
    } catch (srError) {
      lead.status = "pickup_scheduled";
      lead.adminNotes.push({ text: `Pickup scheduled (manual Shiprocket). Error: ${srError.message}` });
    }

    lead.adminNotes.push({
      text: `Pickup scheduled. AWB: ${lead.awbNumber || "Pending"}, Courier: ${lead.courierName || "TBD"}`,
    });

    await lead.save();
    await sendSellNotification(lead, "pickup_scheduled");

    res.status(200).json({ message: "Pickup scheduled", lead });
  } catch (error) {
    console.error("Schedule pickup error:", error);
    res.status(500).json({ message: "Failed to schedule pickup" });
  }
}

export async function trackLeadPickup(req, res) {
  try {
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (!lead.awbNumber) return res.status(400).json({ message: "No AWB number" });

    let tracking = null;
    try {
      tracking = await trackPickup(lead.awbNumber);
    } catch (e) {
      return res.status(200).json({ message: "Tracking unavailable", tracking: null });
    }

    res.status(200).json({ tracking });
  } catch (error) {
    res.status(500).json({ message: "Failed to track pickup" });
  }
}

export async function getPickupLabel(req, res) {
  try {
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (!lead.shiprocketShipmentId) return res.status(400).json({ message: "No shipment ID" });

    let label;
    try {
      label = await generatePickupLabel([lead.shiprocketShipmentId]);
    } catch (e) {
      return res.status(500).json({ message: "Failed to generate label" });
    }

    if (Buffer.isBuffer(label)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pickup-label-${lead._id}.pdf"`);
      return res.send(label);
    }

    res.status(200).json(label);
  } catch (error) {
    res.status(500).json({ message: "Failed to get label" });
  }
}

export async function getDashboardStats(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      newLeadsToday,
      totalLeads,
      quotesSent,
      pickupsScheduled,
      hardwareReceived,
      completedLeads,
      totalPurchaseValueAgg,
    ] = await Promise.all([
      SellLead.countDocuments({ createdAt: { $gte: today } }),
      SellLead.countDocuments(),
      SellLead.countDocuments({ status: "price_offered" }),
      SellLead.countDocuments({ status: { $in: ["pickup_scheduled", "picked_up", "in_transit"] } }),
      SellLead.countDocuments({ status: "received" }),
      SellLead.countDocuments({ status: "completed" }),
      SellLead.aggregate([
        { $match: { status: { $in: ["paid", "completed"] }, offeredPrice: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$offeredPrice" } } },
      ]),
    ]);

    const totalPurchaseValue = totalPurchaseValueAgg[0]?.total || 0;
    const completedCount = await SellLead.countDocuments({ status: { $in: ["paid", "completed"] } });
    const avgPurchasePrice = completedCount > 0 ? Math.round(totalPurchaseValue / completedCount) : 0;
    const conversionRate = totalLeads > 0 ? Math.round((completedLeads / totalLeads) * 100) : 0;

    const leads = await SellLead.find({ status: { $in: ["paid", "completed"] }, offeredPrice: { $gt: 0 } })
      .sort({ updatedAt: -1 })
      .limit(100);
    let avgTurnaround = 0;
    if (leads.length > 0) {
      const totalHours = leads.reduce((sum, l) => {
        const diff = new Date(l.updatedAt) - new Date(l.createdAt);
        return sum + diff;
      }, 0);
      avgTurnaround = Math.round(totalHours / leads.length / (1000 * 60 * 60 * 24));
    }

    res.status(200).json({
      newLeadsToday,
      totalLeads,
      quotesSent,
      pickupsScheduled,
      hardwareReceived,
      conversionRate,
      averagePurchasePrice: avgPurchasePrice,
      totalPurchaseValue,
      averageTurnaroundTime: avgTurnaround,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
}

export async function handleShiprocketWebhook(req, res) {
  try {
    const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({ message: "Webhook secret not configured" });
    }
    const token = req.headers["x-shiprocket-token"] || req.query.token;
    const a = Buffer.from(String(token || ""));
    const b = Buffer.from(String(webhookSecret));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ message: "Invalid webhook token" });
    }

    const payload = req.body;
    console.log("Shiprocket sell webhook:", JSON.stringify(payload));

    const awb = payload.awb || payload.awb_number || payload.AWB;
    const status = payload.current_status || payload.status;

    if (awb && status) {
      const statusMap = {
        "PICKUP SCHEDULED": "pickup_scheduled",
        "PICKED UP": "picked_up",
        "IN TRANSIT": "in_transit",
        "OUT FOR DELIVERY": "in_transit",
        DELIVERED: "received",
        RTO: "cancelled",
      };

      const validTransitions = {
        new: ["contacted", "price_offered", "cancelled"],
        contacted: ["price_offered", "cancelled"],
        price_offered: ["accepted", "rejected", "cancelled"],
        accepted: ["pickup_scheduled", "cancelled"],
        rejected: ["cancelled"],
        pickup_scheduled: ["picked_up", "cancelled"],
        picked_up: ["in_transit"],
        in_transit: ["received"],
        received: ["testing"],
        testing: ["payment_pending", "completed"],
        payment_pending: ["paid"],
        paid: ["completed"],
        completed: [],
        cancelled: [],
      };

      const mappedStatus = statusMap[status?.toUpperCase()];
      if (mappedStatus) {
        const lead = await SellLead.findOne({ awbNumber: awb });
        if (lead) {
          const allowed = validTransitions[lead.status] || [];
          if (mappedStatus !== lead.status && !allowed.includes(mappedStatus)) {
            console.log(`Webhook: ignoring invalid transition ${lead.status} -> ${mappedStatus} for lead ${lead._id}`);
          } else if (mappedStatus !== lead.status) {
            lead.status = mappedStatus;
            lead.adminNotes.push({ text: `Shiprocket webhook: ${status}` });
            await lead.save();
            await sendSellNotification(lead, mappedStatus);
          }
        }
      }
    }

    res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Shiprocket webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
}

export async function customerRespond(req, res) {
  try {
    const { action } = req.body;
    const lead = await SellLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.user && req.user.email !== lead.customerEmail) {
      return res.status(403).json({ message: "Not authorized to respond to this lead" });
    }

    if (action === "accept") {
      if (lead.status !== "price_offered") {
        return res.status(400).json({ message: "No price offered to accept" });
      }
      lead.status = "accepted";
    } else if (action === "reject") {
      if (lead.status !== "price_offered") {
        return res.status(400).json({ message: "No price offered to reject" });
      }
      lead.status = "rejected";
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    lead.adminNotes.push({ text: `Customer ${action}ed the offer` });
    await lead.save();

    res.status(200).json({ message: `Offer ${action}ed`, lead });
  } catch (error) {
    res.status(500).json({ message: "Failed to respond" });
  }
}

export async function getSellProducts(req, res) {
  try {
    const products = await SellProduct.find({ active: true }).sort({ sortOrder: 1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sell products" });
  }
}

export async function adminGetSellProducts(req, res) {
  try {
    const products = await SellProduct.find().sort({ sortOrder: 1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sell products" });
  }
}

export async function adminCreateSellProduct(req, res) {
  try {
    const { name, icon, image, description, active, sortOrder } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const existing = await SellProduct.findOne({ name });
    if (existing) return res.status(400).json({ message: "Product already exists" });

    let imageUrl = image || "";
    if (req.file) {
      imageUrl = req.file.filename;
    }

    const product = await SellProduct.create({
      name,
      icon: icon || "Box",
      image: imageUrl,
      description: description || "",
      active: active !== false,
      sortOrder: sortOrder || 0,
    });

    res.status(201).json({ message: "Sell product created", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to create sell product" });
  }
}

export async function adminUpdateSellProduct(req, res) {
  try {
    const { name, icon, image, description, active, sortOrder } = req.body;
    const product = await SellProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Sell product not found" });

    if (name) product.name = name;
    if (icon) product.icon = icon;
    if (description !== undefined) product.description = description;
    if (active !== undefined) product.active = active;
    if (sortOrder !== undefined) product.sortOrder = sortOrder;

    if (req.file) {
      product.image = req.file.filename;
    }

    await product.save();
    res.status(200).json({ message: "Sell product updated", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to update sell product" });
  }
}

export async function adminDeleteSellProduct(req, res) {
  try {
    const product = await SellProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Sell product not found" });
    res.status(200).json({ message: "Sell product deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sell product" });
  }
}

export async function adminGetCategories(req, res) {
  try {
    const categories = await SellCategory.find().sort({ sortOrder: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
}

export async function adminCreateCategory(req, res) {
  try {
    const { name, icon, description, active, sortOrder } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });
    let imageUrl = "";
    if (req.file) imageUrl = req.file.filename;
    const cat = await SellCategory.create({ name, icon: icon || "Box", image: imageUrl, description: description || "", active: active !== false, sortOrder: sortOrder || 0 });
    res.status(201).json({ message: "Category created", category: cat });
  } catch (error) {
    res.status(500).json({ message: "Failed to create category" });
  }
}

export async function adminUpdateCategory(req, res) {
  try {
    const { name, icon, description, active, sortOrder } = req.body;
    const cat = await SellCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    if (name) cat.name = name;
    if (icon) cat.icon = icon;
    if (description !== undefined) cat.description = description;
    if (active !== undefined) cat.active = active;
    if (sortOrder !== undefined) cat.sortOrder = sortOrder;
    if (req.file) cat.image = req.file.filename;
    await cat.save();
    res.status(200).json({ message: "Category updated", category: cat });
  } catch (error) {
    res.status(500).json({ message: "Failed to update category" });
  }
}

export async function adminDeleteCategory(req, res) {
  try {
    const cat = await SellCategory.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    await SellBrand.deleteMany({ category: req.params.id });
    res.status(200).json({ message: "Category and related brands deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete category" });
  }
}

export async function adminGetBrands(req, res) {
  try {
    const { category } = req.query;
    let query = {};
    if (category) query.category = category;
    const brands = await SellBrand.find(query).populate("category", "name").sort({ sortOrder: 1 });
    res.status(200).json(brands);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch brands" });
  }
}

export async function adminCreateBrand(req, res) {
  try {
    const { name, category, active, sortOrder } = req.body;
    if (!name || !category) return res.status(400).json({ message: "Name and category required" });
    const brand = await SellBrand.create({ name, category, active: active !== false, sortOrder: sortOrder || 0 });
    const populated = await SellBrand.findById(brand._id).populate("category", "name");
    res.status(201).json({ message: "Brand created", brand: populated });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Brand already exists in this category" });
    res.status(500).json({ message: "Failed to create brand" });
  }
}

export async function adminUpdateBrand(req, res) {
  try {
    const { name, category, active, sortOrder } = req.body;
    const brand = await SellBrand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    if (name) brand.name = name;
    if (category) brand.category = category;
    if (active !== undefined) brand.active = active;
    if (sortOrder !== undefined) brand.sortOrder = sortOrder;
    await brand.save();
    const populated = await SellBrand.findById(brand._id).populate("category", "name");
    res.status(200).json({ message: "Brand updated", brand: populated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update brand" });
  }
}

export async function adminDeleteBrand(req, res) {
  try {
    const brand = await SellBrand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    await SellModel.deleteMany({ brand: req.params.id });
    res.status(200).json({ message: "Brand and related models deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete brand" });
  }
}

export async function adminGetModels(req, res) {
  try {
    const { brand } = req.query;
    let query = {};
    if (brand) query.brand = brand;
    const models = await SellModel.find(query).populate({ path: "brand", populate: { path: "category", select: "name" } }).sort({ sortOrder: 1 });
    res.status(200).json(models);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch models" });
  }
}

export async function adminCreateModel(req, res) {
  try {
    const { name, brand, active, sortOrder } = req.body;
    if (!name || !brand) return res.status(400).json({ message: "Name and brand required" });
    const model = await SellModel.create({ name, brand, active: active !== false, sortOrder: sortOrder || 0 });
    const populated = await SellModel.findById(model._id).populate({ path: "brand", populate: { path: "category", select: "name" } });
    res.status(201).json({ message: "Model created", model: populated });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Model already exists for this brand" });
    res.status(500).json({ message: "Failed to create model" });
  }
}

export async function adminUpdateModel(req, res) {
  try {
    const { name, brand, active, sortOrder } = req.body;
    const model = await SellModel.findById(req.params.id);
    if (!model) return res.status(404).json({ message: "Model not found" });
    if (name) model.name = name;
    if (brand) model.brand = brand;
    if (active !== undefined) model.active = active;
    if (sortOrder !== undefined) model.sortOrder = sortOrder;
    await model.save();
    const populated = await SellModel.findById(model._id).populate({ path: "brand", populate: { path: "category", select: "name" } });
    res.status(200).json({ message: "Model updated", model: populated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update model" });
  }
}

export async function adminDeleteModel(req, res) {
  try {
    const model = await SellModel.findByIdAndDelete(req.params.id);
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.status(200).json({ message: "Model deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete model" });
  }
}

export async function getSellCascadingData(req, res) {
  try {
    const conditions = req.query.condition || "new";

    const categories = await SellCategory.find({ active: true }).sort({ sortOrder: 1 });

    const brands = await SellBrand.find({ active: true }).populate("category", "name active").sort({ sortOrder: 1 });

    const models = await SellModel.find({ active: true })
      .populate({ path: "brand", select: "name active", populate: { path: "category", select: "name active" } })
      .sort({ sortOrder: 1 });

    res.status(200).json({ categories, brands, models });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch data" });
  }
}
