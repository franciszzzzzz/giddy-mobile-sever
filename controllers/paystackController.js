import axios from "axios";
import crypto from "crypto";
import Payment from "../models/paymentModel.js";
import { wc } from "../config/db.js";
import { deleteCart } from "../services/cartService.js";
import NotificationService from "../services/notification.service.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ✅ Initialize transaction
export const initializePayment = handleAsyncError(async (req, res, next) => {
  const { orderId, idempotencyKey } = req.body;

  if (!orderId || !idempotencyKey) {
    return next(
      new HandleError("Order ID and idempotency key are required.", 400),
    );
  }

  const payment = await Payment.findOne({
    wcOrderId: Number(orderId),
    idempotencyKey,
  });

  if (!payment) {
    return next(new HandleError("Payment record not found.", 404));
  }

  if (payment.status === "paid") {
    return next(new HandleError("This order has already been paid for.", 400));
  }

  if (payment.reference) {
    return res.status(200).json({
      success: true,
      message: "Payment already initialized.",
      authorization_url: null,
      access_code: null,
      reference: payment.reference,
    });
  }

  const { data: order } = await wc.get(`/orders/${orderId}`);

  if (order.date_paid || order.status === "processing") {
    payment.status = "paid";
    await payment.save();

    return next(new HandleError("This order has already been paid.", 400));
  }

  const { data } = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: order.billing.email,
      amount: Math.round(payment.amount * 100),
      currency: "NGN",
      metadata: {
        wcOrderId: payment.wcOrderId,
        customerId: payment.customerId,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
        "Idempotency-Key": payment.idempotencyKey,
      },
    },
  );

  payment.reference = data.data.reference;
  payment.status = "initialized";

  await payment.save();

  return res.status(200).json({
    success: true,
    message: "Payment initialized successfully.",
    authorization_url: data.data.authorization_url,
    access_code: data.data.access_code,
    reference: data.data.reference,
    payment: {
      orderId: payment.wcOrderId,
      amount: payment.amount,
      status: payment.status,
    },
  });
});

// ✅ Verify transaction
export const verifyPayment = handleAsyncError(async (req, res, next) => {
  const { reference } = req.params;

  const payment = await Payment.findOne({ reference });

  if (!payment) {
    return next(new HandleError("Payment record not found.", 404));
  }

  if (payment.status === "paid") {
    return res.status(200).json({
      success: true,
      message: "Payment already verified.",
    });
  }

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

  payment.status = "paid";
  payment.paidAt = new Date(transaction.paid_at);

  await payment.save();

  await wc.put(`/orders/${payment.wcOrderId}`, {
    status: "processing",
    set_paid: true,
    transaction_id: reference,
  });

  await deleteCart(payment.customerId);

  // Send payment notification
  try {
    await NotificationService.send({
      userId: payment.customerId,
      title: "💳 Payment Successful",
      body: `Your payment for Order #${payment.wcOrderId} was successful.`,
      type: "order",
      data: {
        screen: "Payment",
      },
    });
  } catch (error) {
    console.error("Failed to send payment notification:", error);
  }

  return res.status(200).json({
    success: true,
    message: "Payment verified successfully.",
  });
});

// ✅ Webhook (optional but recommended)
export const paymentWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];

    if (hash !== signature) {
      return res.status(401).send("Invalid signature");
    }

    if (req.body.event !== "charge.success") {
      return res.status(200).send("Ignored");
    }

    const transaction = req.body.data;
    const reference = transaction.reference;

    const payment = await Payment.findOne({ reference });

    if (!payment) {
      return res.status(404).send("Payment not found");
    }

    if (payment.status === "paid") {
      return res.status(200).send("Already processed");
    }

    payment.status = "paid";
    payment.paidAt = new Date(transaction.paid_at);

    await payment.save();

    await wc.put(`/orders/${payment.wcOrderId}`, {
      status: "processing",
      set_paid: true,
      transaction_id: reference,
    });

    await deleteCart(payment.customerId);

    // Send payment notification
    try {
      await NotificationService.send({
        userId: payment.customerId,
        title: "💳 Payment Successful",
        body: `Your payment for Order #${payment.wcOrderId} was successful.`,
        type: "order",
        data: {
          screen: "Payment",
        },
      });
    } catch (error) {
      console.error("Failed to send payment notification:", error);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);

    return res.status(500).send("Webhook Failed");
  }
};
