import axios from "axios";

const RETRY_DELAY = 5000; // 5 seconds
const AUTH_HEADER = "X-Backend-Auth-Token";
const SECRET_TOKEN = process.env.WP_DEV_TOKEN;
const SOURCE_URL = process.env.RENDER_SERVICE_URL;

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
    Origin: SOURCE_URL, // Tells the server where the request is from
    [AUTH_HEADER]: SECRET_TOKEN, // The secret key
  },
});

export const wp = axios.create({
  baseURL: process.env.WP_BASE_URL,
  timeout: 10000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: SOURCE_URL,
    [AUTH_HEADER]: SECRET_TOKEN,
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
