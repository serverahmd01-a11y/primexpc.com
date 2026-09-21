import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { sendOrderDelivered } from "../config/email.js";
import { generateOrderNumber } from "../utils/order.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(process.cwd(), "uploads");

function getImageUrl(filename) {
  return `/uploads/${filename}`;
}

function getVideoUrl(files) {
  if (!files || files.length === 0) return "";
  const videoFile = files.find((f) => f.mimetype.startsWith("video/"));
  return videoFile ? `/uploads/${videoFile.filename}` : "";
}

function deleteImageFile(filename) {
  try {
    const safeName = path.basename(filename);
    if (safeName.includes("..") || safeName !== filename) return;
    const filepath = path.join(uploadsDir, safeName);
    const resolved = path.resolve(filepath);
    if (!resolved.startsWith(path.resolve(uploadsDir))) return;
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
}

export async function createProduct(req, res) {
  try {
    const { name, description, price, stock, category, subCategory, condition, featured, salePrice, dealEndsAt, gstRate, specifications } = req.body;

    const imageUrls = (req.files || []).filter((f) => f.mimetype.startsWith("image/")).map((file) => getImageUrl(file.filename));
    if (imageUrls.length > 3) {
      return res.status(400).json({ message: "Maximum 3 images allowed" });
    }

    let specs = [];
    if (specifications) {
      try { specs = JSON.parse(specifications); } catch { specs = []; }
    }

    const product = await Product.create({
      name: name || "",
      description: description || "",
      price: price ? parseFloat(price) : 0,
      stock: stock ? parseInt(stock) : 0,
      category: category || "Uncategorized",
      subCategory: subCategory || "",
      condition: condition || "new",
      images: imageUrls,
      featured: featured === "true" || featured === true,
      salePrice: salePrice ? parseFloat(salePrice) : 0,
      dealEndsAt: dealEndsAt || null,
      gstRate: gstRate ? parseFloat(gstRate) : 18,
      specifications: specs,
      video: getVideoUrl(req.files),
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllProducts(_, res) {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category, subCategory, condition, featured, salePrice, dealEndsAt, gstRate, specifications } = req.body;

    console.log("[updateProduct] id:", id, "| body keys:", Object.keys(req.body || {}), "| stock:", stock, "| files:", req.files?.length);

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (stock !== undefined) product.stock = parseInt(stock);
    if (category) product.category = category;
    if (subCategory !== undefined) product.subCategory = subCategory;
    if (condition !== undefined) product.condition = condition;
    if (featured !== undefined) product.featured = featured === "true" || featured === true;
    if (salePrice !== undefined) product.salePrice = salePrice ? parseFloat(salePrice) : 0;
    if (dealEndsAt !== undefined) product.dealEndsAt = dealEndsAt || null;
    if (gstRate !== undefined) product.gstRate = gstRate ? parseFloat(gstRate) : 18;
    if (specifications !== undefined) {
      try { product.specifications = JSON.parse(specifications); } catch { product.specifications = []; }
    }

    const removedImages = req.body.removedImages ? JSON.parse(req.body.removedImages) : [];
    if (removedImages.length > 0) {
      for (const imgUrl of removedImages) {
        const filename = imgUrl.split("/uploads/")[1];
        if (filename) deleteImageFile(filename);
      }
      product.images = (product.images || []).filter((img) => !removedImages.includes(img));
    }

    if (req.files && req.files.length > 0) {
      const videoFile = req.files.find((f) => f.mimetype.startsWith("video/"));
      if (videoFile) product.video = getVideoUrl([videoFile]);

      const imageFiles = req.files.filter((f) => f.mimetype.startsWith("image/"));
      if (imageFiles.length > 0) {
        product.images = [...(product.images || []), ...imageFiles.map((file) => getImageUrl(file.filename))];
        if (product.images.length > 3) product.images = product.images.slice(-3);
      }
    }

    await product.save();
    res.status(200).json(product);
  } catch (error) {
    console.error("Error updating products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateProductStock(req, res) {
  try {
    const { id } = req.params;
    const stock = Number(req.body?.stock);

    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ message: "Stock must be a whole number greater than or equal to 0" });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { stock } },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ message: "Stock updated", product });
  } catch (error) {
    console.error("Error updating product stock:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getOrderById(req, res) {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("user", "name email")
      .populate("orderItems.product");
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllOrders(_, res) {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error in getAllOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!["pending", "shipped", "delivered", "cancelled", "returned"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.status = status;

    if (status === "shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    }

    if (status === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();

    if (status === "delivered") {
      const populated = await Order.findById(orderId).populate("user");
      if (populated?.user?.email) {
        sendOrderDelivered(populated, populated.user.email).catch(() => {});
      }
    }

    res.status(200).json({ message: "Order status updated successfully", order });
  } catch (error) {
    console.error("Error in updateOrderStatus controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function toggleAdvancePaid(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    order.advancePaid = !order.advancePaid;
    await order.save();
    res.status(200).json({ message: "Advance status updated", advancePaid: order.advancePaid });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function toggleBalancePaid(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    order.balancePaid = !order.balancePaid;
    order.balancePaidAt = order.balancePaid ? new Date() : null;
    await order.save();
    res.status(200).json({ message: "Balance payment status updated", balancePaid: order.balancePaid });
  } catch (error) {
    console.error("Error in toggleBalancePaid:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function settleOrder(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    order.advancePaid = true;
    order.balancePaid = true;
    order.balancePaidAt = new Date();
    await order.save();
    res.status(200).json({ message: "Order settled (advance + balance paid)", order });
  } catch (error) {
    console.error("Error in settleOrder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrderTracking(req, res) {
  try {
    const { orderId } = req.params;
    let trackingUrl = typeof req.body.trackingUrl === "string" ? req.body.trackingUrl.trim() : "";

    // Always make sure the saved link is an absolute http(s) URL,
    // otherwise clicking it opens a broken/blank page in the new tab.
    if (trackingUrl) {
      if (!/^https?:\/\//i.test(trackingUrl)) trackingUrl = `https://${trackingUrl}`;
      try {
        const parsed = new URL(trackingUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") trackingUrl = "";
      } catch {
        trackingUrl = "";
      }
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.trackingUrl = trackingUrl;
    await order.save();

    res.status(200).json({ message: "Tracking link updated", trackingUrl: order.trackingUrl });
  } catch (error) {
    console.error("Error in updateOrderTracking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllCustomers(_, res) {
  try {
    const customers = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getDashboardStats(_, res) {
  try {
    const totalOrders = await Order.countDocuments();

    const revenueResult = await Order.aggregate([
      {
        $match: {
          status: { $nin: ["cancelled", "returned"] },
          $or: [
            { "paymentResult.status": { $ne: "cod_advance" } },
            { advancePaid: true, balancePaid: true },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;
    const totalCustomers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();

    res.status(200).json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.images && product.images.length > 0) {
      for (const imgUrl of product.images) {
        const filename = imgUrl.split("/uploads/")[1];
        if (filename) deleteImageFile(filename);
      }
    }

    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
};

export async function getCustomerDetail(req, res) {
  try {
    const { customerId } = req.params;
    const customer = await User.findById(customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const orders = await Order.find({ user: customerId })
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      customer: customer.toSafeObject(),
      orders,
    });
  } catch (error) {
    console.error("Error fetching customer detail:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateCustomer(req, res) {
  try {
    const { customerId } = req.params;
    const { name, email, password, role, addresses } = req.body;

    const customer = await User.findById(customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (name !== undefined) {
      const safeName = String(name).replace(/[<>"'&]/g, "").trim();
      if (safeName.length < 2 || safeName.length > 50) {
        return res.status(400).json({ error: "Name must be 2-50 chars" });
      }
      customer.name = safeName;
    }

    if (email !== undefined) {
      const safeEmail = String(email).replace(/[<>"'&]/g, "").toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
        return res.status(400).json({ error: "Invalid email" });
      }
      const dup = await User.findOne({ email: safeEmail, _id: { $ne: customerId } });
      if (dup) return res.status(400).json({ error: "Email already in use" });
      customer.email = safeEmail;
    }

    if (password !== undefined && password !== "") {
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 chars" });
      }
      customer.password = await bcrypt.hash(password, 10);
    }

    if (role !== undefined && ["user", "admin", "ca", "shipping"].includes(role)) {
      customer.role = role;
    }

    if (addresses !== undefined) {
      if (!Array.isArray(addresses)) return res.status(400).json({ error: "Addresses must be an array" });
      customer.addresses = addresses.map((a) => ({
        label: a.label || "Address",
        fullName: a.fullName || customer.name || "",
        streetAddress: a.streetAddress || "",
        city: a.city || "",
        state: a.state || "",
        zipCode: a.zipCode || "",
        phoneNumber: a.phoneNumber || "",
        isDefault: a.isDefault === true,
      }));
    }

    await customer.save();

    res.status(200).json({
      message: "Customer updated",
      customer: customer.toSafeObject(),
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createCustomer(req, res) {
  try {
    const { name, email, password, role, addresses } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password required" });
    }
    const safeName = String(name).replace(/[<>"'&]/g, "").trim();
    const safeEmail = String(email).replace(/[<>"'&]/g, "").toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (password.length < 8) return res.status(400).json({ error: "Password min 8 chars" });
    const exists = await User.findOne({ email: safeEmail });
    if (exists) return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: safeName,
      email: safeEmail,
      password: hashed,
      role: ["admin", "ca", "shipping", "user"].includes(role) ? role : "user",
      addresses: Array.isArray(addresses) ? addresses.map((a) => ({
        label: a.label || "Address",
        fullName: a.fullName || safeName,
        streetAddress: a.streetAddress || "",
        city: a.city || "",
        state: a.state || "",
        zipCode: a.zipCode || "",
        phoneNumber: a.phoneNumber || "",
        isDefault: a.isDefault === true,
      })) : [],
    });

    res.status(201).json({ message: "Customer created", customer: user.toSafeObject() });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getOrderStats(_, res) {
  try {
    const total = await Order.countDocuments();
    const cod = await Order.countDocuments({ "paymentResult.status": "cod_advance" });
    const codAdvancePaid = await Order.countDocuments({ "paymentResult.status": "cod_advance", advancePaid: true });
    const codBalancePending = await Order.countDocuments({ "paymentResult.status": "cod_advance", balancePaid: false });
    const codSettled = await Order.countDocuments({ "paymentResult.status": "cod_advance", balancePaid: true });

    const codAgg = await Order.aggregate([
      { $match: { "paymentResult.status": "cod_advance", advancePaid: true } },
      { $group: { _id: null, totalAdvance: { $sum: "$codAdvanceAmount" }, totalValue: { $sum: "$totalPrice" } } },
    ]);
    const codStats = codAgg[0] || { totalAdvance: 0, totalValue: 0 };

    const statusBreakdown = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = {};
    for (const s of statusBreakdown) byStatus[s._id] = s.count;

    const prepaid = total - cod;

    res.status(200).json({
      total,
      prepaid,
      cod,
      codAdvancePaid,
      codBalancePending,
      codSettled,
      codTotalAdvance: codStats.totalAdvance || 0,
      codTotalValue: codStats.totalValue || 0,
      byStatus,
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMissedOrders(_, res) {
  try {
    const orders = await Order.find({ isMissedOrder: true })
      .populate("user", "name email")
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error in getMissedOrders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createMissedOrder(req, res) {
  try {
    const { userId, items, paymentType, totalPrice, codAdvanceAmount, razorpayPaymentId, shippingAddress } = req.body;

    if (!userId) return res.status(400).json({ error: "User is required" });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one product is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const orderItems = [];
    let computedTotal = 0;

    for (const it of items) {
      if (!it.productId) return res.status(400).json({ error: "Product ID missing" });
      const product = await Product.findById(it.productId);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const quantity = Math.max(1, parseInt(it.quantity) || 1);
      if (product.stock < quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const price = product.salePrice || product.price;
      computedTotal += price * quantity;
      orderItems.push({
        product: product._id,
        name: product.name,
        price,
        quantity,
        condition: product.condition || "new",
        gstRate: product.gstRate || 18,
        image: product.images?.[0] || "",
      });
    }

    const total = totalPrice ? parseFloat(totalPrice) : computedTotal;
    const isCod = paymentType === "cod";

    let address;
    if (shippingAddress && shippingAddress.streetAddress) {
      address = {
        fullName: shippingAddress.fullName || user.name || "Customer",
        streetAddress: shippingAddress.streetAddress,
        city: shippingAddress.city || "",
        state: shippingAddress.state || "",
        zipCode: shippingAddress.zipCode || "",
        phoneNumber: shippingAddress.phoneNumber || "",
      };
    } else {
      const defaultAddress = (user.addresses || []).find((a) => a.isDefault) || (user.addresses || [])[0];
      address = defaultAddress
        ? {
            fullName: defaultAddress.fullName || user.name,
            streetAddress: defaultAddress.streetAddress,
            city: defaultAddress.city,
            state: defaultAddress.state,
            zipCode: defaultAddress.zipCode,
            phoneNumber: defaultAddress.phoneNumber,
          }
        : {
            fullName: user.name || "Customer",
            streetAddress: "-",
            city: "-",
            state: "-",
            zipCode: "000000",
            phoneNumber: "-",
          };
    }

    const order = await Order.create({
      user: user._id,
      orderNumber: await generateOrderNumber(Order),
      orderItems,
      shippingAddress: address,
      totalPrice: total,
      isMissedOrder: true,
      paymentResult: {
        id: razorpayPaymentId || `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        status: isCod ? "cod_advance" : "captured",
        ...(razorpayPaymentId ? { source: "razorpay" } : {}),
      },
      codAdvanceAmount: isCod ? (codAdvanceAmount ? parseFloat(codAdvanceAmount) : Math.round(total * 0.25)) : 0,
      advancePaid: true,
      balancePaid: !isCod,
      balancePaidAt: !isCod ? new Date() : null,
    });

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
    }

    res.status(201).json({ message: "Missed order created successfully", order });
  } catch (error) {
    console.error("Error in createMissedOrder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
