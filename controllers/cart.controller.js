import mongoose from "mongoose";
import ShoppingCart from "../models/ShoppingCart.js";
import { wc } from "../config/db.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";

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
  // Verify product exists in WooCommerce
  //

  let product;

  try {
    const response = await wc.get(`/products/${productId}`);

    product = response.data;
  } catch (error) {
    return next(new HandleError("Product not found.", 404));
  }

  //
  // Optional
  // Verify variation exists
  //

  if (variationId) {
    try {
      await wc.get(`/products/${productId}/variations/${variationId}`);
    } catch (error) {
      return next(new HandleError("Variation not found.", 404));
    }
  }

  //
  // Check stock
  //

  if (product.manage_stock && Number(product.stock_quantity) < quantity) {
    return next(new HandleError("Insufficient stock.", 400));
  }

  //
  // Find Cart
  //
  console.log("Mongo Ready State:", mongoose.connection.readyState);
  console.log("Database:", mongoose.connection.name);
  console.log(mongoose.modelNames());

  console.log(
    "ShoppingCart connection === mongoose.connection",
    ShoppingCart.db === mongoose.connection,
  );
  let cart = await ShoppingCart.findOne({
    customerId,
  });

  //
  //
  //  Create Cart
  //

  if (!cart) {
    cart = await ShoppingCart.create({
      customerId,
      items: [],
    });
  }

  //
  // Existing Item?
  //

  const existingItem = cart.items.find(
    (item) => item.productId === productId && item.variationId === variationId,
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      productId,
      variationId,
      quantity,
    });
  }

  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Product added to cart.",
    cart,
  });
});
