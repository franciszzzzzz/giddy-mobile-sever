import mongoose from "mongoose";
const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: Number,
      required: true,
    },

    variationId: {
      type: Number,
      default: null,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false },
);

const shoppingCartSchema = new mongoose.Schema(
  {
    customerId: {
      type: Number,
      required: true,
      unique: true,
    },

    items: [cartItemSchema],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("ShoppingCart", shoppingCartSchema);
