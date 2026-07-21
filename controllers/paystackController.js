// ✅ Initialize transaction
import axios from "axios";
import Payment from "../models/payment.js";
import { wc } from "../config/db.js";
import { deleteCart } from "../utils/cartService.js";
import HandleError from "../middleware/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export const initializePayment = handleAsyncError(async (req, res, next) => {
  const { orderId, idempotencyKey } = req.body;

  if (!orderId || !idempotencyKey) {
    return next(
      new HandleError("Order ID and idempotency key are required.", 400),
    );
  }

  //
  // Find Payment
  //
  const payment = await Payment.findOne({
    wcOrderId: orderId,
    idempotencyKey,
  });

  if (!payment) {
    return next(new HandleError("Payment record not found.", 404));
  }

  //
  // Already initialized?
  //
  if (payment.reference) {
    return res.status(200).json({
      success: true,
      message: "Payment already initialized.",
      reference: payment.reference,
    });
  }

  //
  // Get WooCommerce order
  //
  const { data: order } = await wc.get(`/orders/${orderId}`);

  //
  // Initialize Paystack
  //
  const { data } = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: order.billing.email,
      amount: payment.amount,

      metadata: {
        orderId,
        customerId: payment.customerId,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    },
  );

  //
  // Save reference
  //
  payment.reference = data.data.reference;
  payment.status = "initialized";

  await payment.save();

  return res.status(200).json({
    success: true,

    authorization_url: data.data.authorization_url,

    access_code: data.data.access_code,

    reference: data.data.reference,
  });
});

// ✅ Verify transaction
export const verifyPayment = handleAsyncError(async (req, res, next) => {
  const { reference } = req.params;

  //
  // Find payment
  //
  const payment = await Payment.findOne({ reference });

  if (!payment) {
    return next(new HandleError("Payment record not found.", 404));
  }

  //
  // Idempotency
  //
  if (payment.status === "paid") {
    return res.status(200).json({
      success: true,
      message: "Payment already verified.",
    });
  }

  //
  // Verify with Paystack
  //
  const { data } = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    },
  );

  const transaction = data.data;

  if (transaction.status !== "success") {
    payment.status = "failed";
    await payment.save();

    return next(new HandleError("Payment verification failed.", 400));
  }

  //
  // Update payment
  //
  payment.status = "paid";
  payment.paidAt = new Date(transaction.paid_at);

  await payment.save();

  //
  // Update WooCommerce order
  //
  await wc.put(`/orders/${payment.wcOrderId}`, {
    status: "processing",
    set_paid: true,
    transaction_id: reference,
  });

  //
  // Clear customer's cart
  //
  await deleteCart(payment.customerId);

  return res.status(200).json({
    success: true,
    message: "Payment verified successfully.",
  });
});

// ✅ Webhook (optional but recommended)
export const paymentWebhook = async (req, res) => {
  try {
    //
    // Verify Paystack Signature
    //
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];

    if (hash !== signature) {
      return res.status(401).send("Invalid signature");
    }

    //
    // We only care about successful charges
    //
    if (req.body.event !== "charge.success") {
      return res.status(200).send("Ignored");
    }

    const transaction = req.body.data;

    const reference = transaction.reference;

    //
    // Find payment
    //
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      return res.status(404).send("Payment not found");
    }

    //
    // Already processed?
    //
    if (payment.status === "paid") {
      return res.status(200).send("Already processed");
    }

    //
    // Update Payment
    //
    payment.status = "paid";
    payment.paidAt = new Date(transaction.paid_at);

    await payment.save();

    //
    // Update WooCommerce Order
    //
    await wc.put(`/orders/${payment.wcOrderId}`, {
      status: "processing",
      set_paid: true,
      transaction_id: reference,
    });

    //
    // Clear Cart
    //
    await deleteCart(payment.customerId);

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);

    return res.status(500).send("Webhook Failed");
  }
};
