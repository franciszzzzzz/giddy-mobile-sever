import axios from "axios";
import mongoose from "mongoose";

const RETRY_DELAY = 5000; // 5 seconds

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI); // ✅ clean modern syntax
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    console.log(`⏳ Retrying in ${RETRY_DELAY / 1000} seconds...`);
    setTimeout(connectMongoDb, RETRY_DELAY);
  }
};

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
});

console.log("WC INSTANCE URL:", process.env.WC_BASE_URL);

export const wc = axios.create({
  baseURL: process.env.WC_BASE_URL,

  timeout: 10000,

  auth: {
    username: process.env.WC_CONSUMER_KEY,
    password: process.env.WC_CONSUMER_SECRET,
  },

  headers: {
    Accept: "application/json",
    "X-Dev-Server-Token": process.env.WP_DEV_TOKEN,
  },
});

export const wp = axios.create({
  baseURL: process.env.WP_BASE_URL,

  timeout: 10000,

  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Dev-Server-Token": process.env.WP_DEV_TOKEN,
  },
});

/**
 * Global error logger (VERY important for production debugging)
 */
wc.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ WooCommerce API Error");
    console.error("Endpoint:", error.config?.url);
    console.error("Message:", error.message);
    console.error("Response:", error?.response?.data);
    return Promise.reject(error);
  },
);
