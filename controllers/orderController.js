import crypto from "crypto";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import { calculateShipping } from "../utils/shipping.js";
import { wc, wp } from "../config/db.js";
import { getCartByCustomer } from "../utils/cartService.js";
import Payment from "../models/paymentModel.js";

export const createNewOrder = handleAsyncError(async (req, res, next) => {
  const { shippingInfo } = req.body;

  //
  // Validate shipping info
  //
  if (!shippingInfo) {
    return next(new HandleError("Shipping information is required.", 400));
  }

  //
  // Calculate shipping & tax
  //
  const shippingPrice = calculateShipping(shippingInfo.state);
  const taxPrice = 0;

  //
  // Get customer's cart
  //
  const cart = await getCartByCustomer(req.user.id);

  if (!cart || cart.items.length === 0) {
    return next(new HandleError("Cart is empty.", 400));
  }

  //
  // Build WooCommerce line items
  //
  const line_items = cart.items.map((item) => ({
    product_id: Number(item.productId),
    variation_id: item.variationId ? Number(item.variationId) : undefined,
    quantity: Number(item.quantity),
  }));

  //
  // Create WooCommerce Order
  //
  const response = await wc.post("/orders", {
    customer_id: req.user.id,

    status: "pending",

    payment_method: "paystack",
    payment_method_title: "Paystack",

    set_paid: false,

    billing: {
      first_name: shippingInfo.firstName,
      last_name: shippingInfo.lastName,
      address_1: shippingInfo.address_1,
      address_2: shippingInfo.address_2 || "",
      city: shippingInfo.city,
      state: shippingInfo.state,
      postcode: shippingInfo.postcode,
      country: shippingInfo.country,
      phone: shippingInfo.phone,
      email: req.user.email,
    },

    shipping: {
      first_name: shippingInfo.firstName,
      last_name: shippingInfo.lastName,
      address_1: shippingInfo.address_1,
      address_2: shippingInfo.address_2 || "",
      city: shippingInfo.city,
      state: shippingInfo.state,
      postcode: shippingInfo.postcode,
      country: shippingInfo.country,
    },

    line_items,

    shipping_lines: [
      {
        method_id: "flat_rate",
        method_title: "Shipping",
        total: String(shippingPrice),
      },
    ],
  });
  const idempotencyKey = crypto.randomUUID();
  await Payment.create({
    customerId: req.user.id,
    wcOrderId: response.data.id,
    amount: parseFloat(response.data.total),
    idempotencyKey,
    status: "pending",
    paymentMethod: "paystack",
  });
  return res.status(201).json({
    success: true,
    message: "Order created successfully.",
    shippingPrice,
    taxPrice,
    idempotencyKey,
    order: response.data,
  });
});
// Getting Single Product
export const getSingleOrder = handleAsyncError(async (req, res, next) => {
  const { id } = req.params;

  try {
    const response = await wc.get(`/orders/${id}`);

    const order = response.data;

    // Ensure the order belongs to the authenticated customer
    if (Number(order.customer_id) !== Number(req.user.id)) {
      return next(new HandleError("Unauthorized.", 403));
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return next(new HandleError("Order not found.", 404));
    }

    return next(
      new HandleError(
        error.response?.data?.message || "Unable to fetch order.",
        error.response?.status || 500,
      ),
    );
  }
});

// Get all orders of the logged-in customer
export const allMyOrders = handleAsyncError(async (req, res, next) => {
  try {
    const response = await wc.get("/orders", {
      params: {
        customer: req.user.id,
        per_page: 100, // adjust if needed
        page: 1,
        orderby: "date",
        order: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      orders: response.data,
    });
  } catch (error) {
    console.error("GET ORDERS ERROR:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("Message:", error.message);

    return next(
      new HandleError(
        error.response?.data?.message || "Unable to fetch orders.",
        error.response?.status || 500,
      ),
    );
  }
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
    0,
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
    order.orderItems.map((item) => updateQuantity(item.product, item.quantity)),
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

// Deleting Order
export const deleteOrder = handleAsyncError(async (req, res, next) => {
  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return next(new HandleError("Order Not Found", 404));
  }
  if (order.orderStatus !== "Delivered") {
    return next(
      new HandleError("Order is Under Processing And Cannot Be Deleted ", 400),
    );
  }
  await order.deleteOne({ _id: req.params.id });
  res.status(200).json({
    success: true,
    message: "Order Deleted Successfully",
  });
});
