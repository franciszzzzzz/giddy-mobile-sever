import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";

// Create New Order
export const createNewOrder = handleAsyncError(async (req, res, next) => {
  const {
    shippingInfo,
    orderItems,
    paymentInfo,
    itemPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    orderStatus,
  } = req.body;
  // ADD LOGGING to see what's being received
  console.log("📥 Received order data:", {
    orderStatus: orderStatus,
    paymentInfo: paymentInfo,
    fullBody: req.body,
  });
  // Check if an order with this payment reference already exists
  const existingOrder = await orderModel.findOne({
    "paymentInfo.id": paymentInfo.id,
    user: req.user._id,
  });

  if (existingOrder) {
    // Update the existing order with new order items
    existingOrder.orderItems = orderItems;
    existingOrder.itemPrice = itemPrice;
    existingOrder.taxPrice = taxPrice;
    existingOrder.shippingPrice = shippingPrice;
    existingOrder.totalPrice = totalPrice;
    existingOrder.shippingInfo = shippingInfo;

    await existingOrder.save();

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: existingOrder,
    });
  }

  if (!orderItems || orderItems.length === 0) {
    return next(new ErrorHandler("Cart is empty", 400));
  }

  // Create new order if none exists
  const order = await orderModel.create({
    shippingInfo,
    orderItems,
    paymentInfo,
    itemPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paidAt: Date.now(),
    user: req.user._id,
  });

  res.status(201).json({
    success: true,
    order,
  });
});

// Getting Single Product
export const getSingleOrder = handleAsyncError(async (req, res, next) => {
  const order = await orderModel
    .findById(req.params.id)
    .populate("user", "name email");
  if (!order) {
    return next(new HandleError("Order Not Found", 404));
  }
  res.status(200).json({
    success: true,
    order,
  });
});

//Getting Order of Login User
export const allMyOrders = handleAsyncError(async (req, res, next) => {
  const orders = await orderModel.find({ user: req.user._id });
  if (!orders) {
    return next(new HandleError("Orders not found", 404));
  }
  res.status(200).json({
    success: true,
    orders,
  });
});

//Getting All Orders
export const getAllOrders = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Total count without limit (not capped)
  const totalOrders = await orderModel.countDocuments();

  // Page data
  const orders = await orderModel
    .find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Compute totalAmount across ALL orders (not just current page)
  const allForAmount = await orderModel.find().select("totalPrice");
  const totalAmount = allForAmount.reduce(
    (sum, o) => sum + (o.totalPrice || 0),
    0
  );

  res.status(200).json({
    success: true,
    orders,
    totalOrders,
    totalAmount,
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(totalOrders / limit)),
    resultPerPage: limit,
  });
});

//Update Order Status
export const updateOrderStatus = handleAsyncError(async (req, res, next) => {
  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return next(new HandleError("Order Not Found", 404));
  }
  if (order.orderStatus === "Delivered") {
    return next(new HandleError("This Order Has Already Been Delivered", 400));
  }
  await Promise.all(
    order.orderItems.map((item) => updateQuantity(item.product, item.quantity))
  );
  order.orderStatus = req.body.status;
  if (order.orderStatus === "Delivered") {
    order.deliveredAt = Date.now();
  }
  await order.save({ validateBeforeSave: false });
  res.status(200).json({
    success: true,
    order,
  });
});

async function updateQuantity(id, quantity) {
  const product = await productModel.findById(id);
  if (!product) {
    throw new Error("Product Not Found");
  }
  product.stock -= quantity;
  await product.save({ validateBeforeSave: false });
}

// Deleting Order
export const deleteOrder = handleAsyncError(async (req, res, next) => {
  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return next(new HandleError("Order Not Found", 404));
  }
  if (order.orderStatus !== "Delivered") {
    return next(
      new HandleError("Order is Under Processing And Cannot Be Deleted ", 400)
    );
  }
  await order.deleteOne({ _id: req.params.id });
  res.status(200).json({
    success: true,
    message: "Order Deleted Successfully",
  });
});
