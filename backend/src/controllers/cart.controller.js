import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";

function getCartId(req) {
  const userId = req.user?._id || null;
  const guestId = req.guestId || null;
  return { userId, guestId };
}

function validateQuantity(q) {
  const n = Number(q);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function getCart(req, res) {
  try {
    const { userId, guestId } = getCartId(req);
    let cart = await Cart.findCart({ userId, guestId });

    if (!cart) {
      if (!userId && !guestId) {
        return res.status(200).json({ cart: { items: [] }, guestId: null });
      }
      const createData = userId ? { user: userId, items: [] } : { guestId, items: [] };
      cart = await Cart.create(createData);
    } else {
      cart = await cart.populate("items.product");
    }

    const guestIdOut = !userId && guestId ? guestId : null;
    res.status(200).json({ cart, guestId: guestIdOut });
  } catch (error) {
    console.error("Error in getCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addToCart(req, res) {
  try {
    const { productId, quantity = 1, condition = "new" } = req.body;
    const { userId, guestId } = getCartId(req);

    const qty = validateQuantity(quantity);
    if (!qty) {
      return res.status(400).json({ error: "Quantity must be a positive integer" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < qty) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    let cart = await Cart.findCart({ userId, guestId });
    if (!cart) {
      const createData = userId ? { user: userId, items: [] } : { guestId, items: [] };
      cart = await Cart.create(createData);
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId && item.condition === condition
    );
    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      if (product.stock < newQuantity) {
        return res.status(400).json({ error: "Insufficient stock" });
      }
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ product: productId, quantity: qty, condition });
    }

    await cart.save();
    await cart.populate("items.product");

    const guestIdOut = !userId && guestId ? guestId : null;
    res.status(200).json({ message: "Item added to cart", cart, guestId: guestIdOut });
  } catch (error) {
    console.error("Error in addToCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateCartItem(req, res) {
  try {
    const { productId } = req.params;
    const { quantity, condition } = req.body;
    const { userId, guestId } = getCartId(req);

    const qty = validateQuantity(quantity);
    if (!qty) {
      return res.status(400).json({ error: "Quantity must be a positive integer" });
    }

    const cart = await Cart.findCart({ userId, guestId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId && (condition ? item.condition === condition : true)
    );
    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < qty) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    cart.items[itemIndex].quantity = qty;
    await cart.save();
    await cart.populate("items.product");

    res.status(200).json({ message: "Cart updated successfully", cart });
  } catch (error) {
    console.error("Error in updateCartItem controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function removeFromCart(req, res) {
  try {
    const { productId } = req.params;
    const { condition } = req.query;
    const { userId, guestId } = getCartId(req);

    const cart = await Cart.findCart({ userId, guestId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => !(item.product.toString() === productId && (!condition || item.condition === condition))
    );
    await cart.save();
    await cart.populate("items.product");

    res.status(200).json({ message: "Item removed from cart", cart });
  } catch (error) {
    console.error("Error in removeFromCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const clearCart = async (req, res) => {
  try {
    const { userId, guestId } = getCartId(req);
    const cart = await Cart.findCart({ userId, guestId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    cart.items = [];
    await cart.save();
    await cart.populate("items.product");

    res.status(200).json({ message: "Cart cleared", cart });
  } catch (error) {
    console.error("Error in clearCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export async function mergeCart(req, res) {
  try {
    const { guestId } = req.body;
    if (!guestId) {
      return res.status(400).json({ error: "guestId is required" });
    }

    const mergedCart = await Cart.mergeGuestCart(req.user._id, guestId);
    res.status(200).json({
      message: "Cart merged successfully",
      cart: mergedCart || { items: [] },
    });
  } catch (error) {
    console.error("Error merging cart:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
