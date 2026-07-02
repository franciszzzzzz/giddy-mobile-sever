import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Product Name"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please Enter A Product Description"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Please Enter A Product Price"],
      trim: true,
      maxLength: [8, "Price Cannot Be More Than 8 Digits"],
    },
    ratings: {
      type: Number,
      default: 0,
    },
    image: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    category: {
      type: String,
      required: [true, "Please Enter A Product Category"],
    },
    stock: {
      type: Number,
      required: [true, "Please Enter Product Stock"],
      trim: true,
      maxLength: [6, "Price Cannot Be More Than 6 Digits"],
      default: 1,
    },
    numberOfReviews: {
      type: Number,
      default: 0,
    },

    reviews: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
      },
    ],
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
