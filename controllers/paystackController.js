import axios from "axios";
import crypto from "crypto";
import handleAsyncError from "../middleware/handleAsyncError.js";
import Order from "../models/orderModel.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ✅ Initialize transaction
export const initializePayment = handleAsyncError(async (req, res) => {
  const { amount, email } = req.body;

  console.log("🟢 Backend payment initialization:", {
    receivedAmount: Number(amount),
    receivedAmountInNaira: Number(amount / 100),
    email: email,
  });

  if (!amount || !email) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: amount or email",
    });
  }

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount, // Make sure this is correct
        currency: "NGN", // Explicitly set currency
        callback_url: "http://localhost:5173/payment/success",
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Paystack response:", {
      paystackAmount: response.data.data.amount,
      paystackAmountInNaira: response.data.data.amount / 100,
      authorization_url: response.data.data.authorization_url,
    });

    return res.status(200).json({
      success: true,
      message: "Payment initialized successfully",
      authorization_url: response.data.data.authorization_url,
      access_code: response.data.data.access_code,
      reference: response.data.data.reference,
    });
  } catch (error) {
    console.error("❌ Paystack API error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.response?.data?.message,
    });

    return res.status(400).json({
      success: false,
      message: error.response?.data?.message || "Payment initialization failed",
    });
  }
});

// ✅ Verify transaction
export const verifyPayment = handleAsyncError(async (req, res) => {
  const { reference } = req.params;

  console.log("🔐 Verifying payment with reference:", reference);

  try {
    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      }
    );

    const data = response.data.data;

    console.log("📊 Paystack verification response:", {
      status: data.status,
      reference: data.reference,
      amount: data.amount,
    });

    if (data.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // ✅ JUST VERIFY PAYMENT - DON'T CREATE ORDER HERE
    // The order should already be created by createNewOrder

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      paymentData: {
        id: data.reference,
        status: data.status,
        amount: data.amount,
        paidAt: data.paid_at,
      },
    });
  } catch (error) {
    console.error("❌ Payment verification error:", error);
    return res.status(400).json({
      success: false,
      message: "Payment verification failed",
    });
  }
});

// ✅ Webhook (optional but recommended)
export const paystackWebhook = handleAsyncError(async (req, res) => {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  const signature = req.headers["x-paystack-signature"];
  if (hash !== signature) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  if (event === "charge.success") {
    const data = req.body.data;
    console.log("Payment Success:", data.reference);
    // Update your DB payment status here
  }

  res.status(200).send("OK");
});
