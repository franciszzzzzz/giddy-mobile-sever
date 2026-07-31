import mongoose from "mongoose";
import ShoppingCart from "../models/ShoppingCart.js";
import { wc } from "../config/db.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";

import {
  getOrCreateCart,
  fetchProductSnapshot,
  validateStock,
  buildCategories,
  getCartByCustomer,
  calculateTotals,
  deleteCart,
  refreshSnapshot,
  findCartItem,
  getCartCount,
  createSnapshotItem,
} from "../services/cartService.js";

export const addToCart = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  let { productId, variationId = null, quantity = 1 } = req.body;

  productId = Number(productId);
  variationId = variationId ? Number(variationId) : null;
  quantity = Number(quantity);

  //
  // Validation
  //

  if (!productId) {
    return next(new HandleError("Product ID is required.", 400));
  }

  if (quantity < 1) {
    return next(new HandleError("Quantity must be at least 1.", 400));
  }

  //
  // Fetch latest WooCommerce product
  //

  const product = await fetchProductSnapshot(productId, variationId);

  //
  // Find or Create Cart
  //

  const cart = await getOrCreateCart(customerId);

  //
  // Existing Item?
  //

  const existingItem = cart.items.find(
    (item) =>
      item.productId === productId &&
      (item.variationId ?? null) === variationId,
  );

  //
  // Stock Validation
  //

  const currentQty = existingItem ? existingItem.quantity : 0;

  validateStock(product, currentQty + quantity);

  //
  // Update Existing Item
  //

  if (existingItem) {
    existingItem.quantity += quantity;

    refreshSnapshot(existingItem, product);
  }

  //
  // Add New Item
  //
  else {
    cart.items.push(
      createSnapshotItem(product, productId, variationId, quantity),
    );
  }

  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Product added to cart.",
    cart,
  });
});

export const getCart = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;
  // Get Cart
  const cart = await ShoppingCart.findOne({ customerId }).lean();

  // Empty Cart
  if (!cart || cart.items.length === 0) {
    return res.status(200).json({
      success: true,
      totalItems: 0,
      subtotal: 0,
      items: [],
    });
  }

  // Calculate totals
  const { subtotal, totalItems, items } = calculateTotals(cart.items);

  return res.status(200).json({
    success: true,
    totalItems,
    subtotal,
    items,
  });
});

export const updateCartItem = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  const productId = Number(req.params.productId);

  const variationId = req.query.variationId
    ? Number(req.query.variationId)
    : null;

  const quantity = Number(req.body.quantity);

  //
  // Validation
  //

  if (!productId) {
    return next(new HandleError("Product ID is required.", 400));
  }

  if (!quantity || quantity < 1) {
    return next(new HandleError("Quantity must be at least 1.", 400));
  }

  //
  // Find Cart
  //

  const cart = await getCartByCustomer(customerId);

  if (!cart) {
    return next(new HandleError("Cart not found.", 404));
  }

  //
  // Find Item
  //

  const item = findCartItem(cart, productId, variationId);

  if (!item) {
    return next(new HandleError("Item not found in cart.", 404));
  }

  //
  // Fetch latest product snapshot
  //

  const product = await fetchProductSnapshot(productId, variationId);

  //
  // Validate stock
  //

  validateStock(product, quantity);

  //
  // Update Quantity
  //

  item.quantity = quantity;

  //
  // Refresh stored snapshot
  //

  refreshSnapshot(item, product);

  //
  // Save
  //

  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Cart updated successfully.",
    cart,
  });
});

export const removeCartItem = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  const productId = Number(req.params.productId);

  const variationId = req.query.variationId
    ? Number(req.query.variationId)
    : null;

  //
  // Validation
  //

  if (!productId) {
    return next(new HandleError("Product ID is required.", 400));
  }

  //
  // Find Cart
  //

  const cart = await getCartByCustomer(customerId);

  if (!cart) {
    return next(new HandleError("Cart not found.", 404));
  }

  //
  // Find Item Index
  //

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.productId === productId &&
      (item.variationId ?? null) === variationId,
  );

  if (itemIndex === -1) {
    return next(new HandleError("Item not found in cart.", 404));
  }

  //
  // Remove Item
  //

  cart.items.splice(itemIndex, 1);

  //
  // Delete empty cart
  //

  if (cart.items.length === 0) {
    await deleteCart(customerId);

    return res.status(200).json({
      success: true,
      message: "Item removed. Cart is now empty.",
      cart: null,
    });
  }

  //
  // Save
  //

  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Item removed from cart.",
    cart,
  });
});

export const clearCart = handleAsyncError(async (req, res) => {
  const customerId = req.user.id;

  //
  // Delete Cart
  //

  const cart = await deleteCart(customerId);

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: "Cart is already empty.",
      totalItems: 0,
      subtotal: 0,
      items: [],
    });
  }

  return res.status(200).json({
    success: true,
    message: "Cart cleared successfully.",
    totalItems: 0,
    subtotal: 0,
    items: [],
  });
});

export const getCartItemCount = handleAsyncError(async (req, res) => {
  const customerId = req.user.id;

  const totalItems = await getCartCount(customerId);

  return res.status(200).json({
    success: true,
    totalItems,
  });
});

export const validateCart = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  //
  // Get Cart
  //

  const cart = await getCartByCustomer(customerId);

  if (!cart || cart.items.length === 0) {
    return res.status(200).json({
      success: true,
      valid: true,
      message: "Cart is empty.",
      issues: [],
    });
  }

  //
  // Validate every cart item in parallel
  //

  const issueGroups = await Promise.all(
    cart.items.map(async (item) => {
      const issues = [];

      let product;

      try {
        product = await fetchProductSnapshot(item.productId, item.variationId);
      } catch {
        issues.push({
          productId: item.productId,
          variationId: item.variationId,
          type: "removed",
          message: "This product no longer exists.",
        });

        return issues;
      }

      //
      // Product unpublished
      //

      if (product.status !== "publish") {
        issues.push({
          productId: item.productId,
          variationId: item.variationId,
          type: "unavailable",
          message: "This product is no longer available.",
        });

        return issues;
      }

      //
      // Out of stock
      //

      if (product.stock_status === "outofstock") {
        issues.push({
          productId: item.productId,
          variationId: item.variationId,
          type: "out_of_stock",
          message: "This product is out of stock.",
        });

        return issues;
      }

      //
      // Quantity validation
      //

      if (
        product.manage_stock &&
        product.stock_quantity !== null &&
        item.quantity > Number(product.stock_quantity)
      ) {
        issues.push({
          productId: item.productId,
          variationId: item.variationId,
          type: "quantity",
          available: Number(product.stock_quantity),
          requested: item.quantity,
          message: `Only ${product.stock_quantity} left in stock.`,
        });
      }

      //
      // Price changed
      //

      if (
        item.price !== product.price ||
        item.salePrice !== product.sale_price
      ) {
        issues.push({
          productId: item.productId,
          variationId: item.variationId,
          type: "price",
          oldPrice: item.salePrice || item.price,
          newPrice: product.sale_price || product.price,
          message: "Price has changed.",
        });
      }

      return issues;
    }),
  );

  //
  // Flatten all issues into one array
  //

  const issues = issueGroups.flat();

  return res.status(200).json({
    success: true,
    valid: issues.length === 0,
    issues,
  });
});

export const syncCart = handleAsyncError(async (req, res, next) => {
  const customerId = req.user.id;

  const items = req.body.items;

  if (!Array.isArray(items)) {
    return next(new HandleError("Items must be an array.", 400));
  }

  const cart = await getOrCreateCart(customerId);

  for (const incoming of items) {
    const productId = Number(incoming.productId);

    const variationId = incoming.variationId
      ? Number(incoming.variationId)
      : null;

    const quantity = Number(incoming.quantity);

    if (!productId || quantity < 1) {
      continue;
    }

    //
    // Fetch latest WooCommerce product
    //

    let product;

    try {
      product = await fetchProductSnapshot(productId, variationId);
    } catch {
      continue;
    }

    //
    // Existing?
    //

    const existing = findCartItem(cart, productId, variationId);

    const mergedQty = existing ? existing.quantity + quantity : quantity;

    //
    // Clamp to stock
    //

    let finalQty = mergedQty;

    if (product.manage_stock) {
      finalQty = Math.min(mergedQty, Number(product.stock_quantity));
    }

    //
    // Update Existing
    //

    if (existing) {
      existing.quantity = finalQty;

      refreshSnapshot(existing, product);
    }

    //
    // Add New
    //
    else {
      cart.items.push(
        createSnapshotItem(product, productId, variationId, finalQty),
      );
    }
  }

  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Cart synchronized successfully.",
    cart,
  });
});
