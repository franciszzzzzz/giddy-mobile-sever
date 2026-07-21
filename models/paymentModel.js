import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    customerId: {
      type: Number,
      required: true,
      index: true,
    },

    wcOrderId: {
      type: Number,
      required: true,
      unique: true,
    },

    reference: {
      type: String,
      unique: true,
      sparse: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["initialized", "pending", "paid", "failed", "cancelled"],
      default: "initialized",
    },

    paymentMethod: {
      type: String,
      default: "paystack",
    },

    paidAt: Date,
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Payment", paymentSchema);
