import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Routes
import product from "./routes/productRoutes.js";
import user from "./routes/userRoutes.js";
import order from "./routes/orderRoute.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoute from "./routes/wishlistRoute.js";
import paystackRoutes from "./routes/paystackRoutes.js";

import notificationRoutes from "./routes/notificationRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

// Middleware
import limiter from "./middleware/rateLimiter.js";
import errorHandleMiddleware from "./middleware/error.js";

const app = express();

// Allowed origins
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://giddyandclaire.com/"]
    : [" http://localhost:8081"];

// CORS setup
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Preflight requests
app.options(
  "*",
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// Rate limiter
app.use(limiter);

// ===============================
//       API ROUTES FIRST
// ===============================
app.use("/api/v1", product);
app.use("/api/v1", user);
app.use("/api/v1", order);
app.use("/api/v1", cartRoutes);
app.use("/api/v1", wishlistRoute);
app.use("/api/v1", paystackRoutes);
app.use("/api/v1", notificationRoutes);
app.use("/api/v1", aiRoutes);

// ===============================
// ERROR HANDLER MUST BE LAST
// ===============================
app.use(errorHandleMiddleware);

// Rate limit debug endpoint
app.get("/api/rate-limit-test", (req, res) => {
  console.log(`📊 Rate limit test hit - IP: ${req.ip}`);
  res.json({
    success: true,
    message: "Rate limit test endpoint",
    timestamp: new Date().toISOString(),
    yourIP: req.ip,
    rateLimitHeaders: {
      limit: res.get("RateLimit-Limit"),
      remaining: res.get("RateLimit-Remaining"),
      reset: res.get("RateLimit-Reset"),
    },
  });
});

export default app;
