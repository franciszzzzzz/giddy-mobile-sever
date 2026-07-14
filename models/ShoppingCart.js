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
    },

    name: {
      type: String,
      required: true,
    },
    slug: String,
    sku: String,

    image: {
      type: String,
      default: null,
    },

    price: {
      type: String,
      required: true,
    },
    regularPrice: String,
    salePrice: String,

    stockStatus: String,
    manageStock: Boolean,
    stockQuantity: {
      type: Number,
      min: 0,
    },

    averageRating: String,
    reviewCount: Number,
    categories: {
      type: [
        {
          id: Number,
          name: String,
          slug: String,
        },
      ],
      default: [],
    },

    addedAt: {
      type: Date,
      default: Date.now,
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
      index: true,
    },

    items: [cartItemSchema],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("ShoppingCart", shoppingCartSchema);
