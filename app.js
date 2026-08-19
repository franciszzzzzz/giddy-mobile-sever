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
import limiter, { authLimiter } from "./middleware/rateLimiter.js";
import { checkIpBan, scannerTrap } from "./middleware/ipBan.js";
import { loginLockout } from "./middleware/loginLockout.js";
import errorHandleMiddleware from "./middleware/error.js";

const app = express();

// Allowed origins
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://giddyandclaire.com"]
    : ["http://localhost:8081"];

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

// Banned identities (scanner trap) are rejected before anything else runs.
app.use(checkIpBan);

// Junk-path scanner trap — counts non-/api requests per identity and bans
// repeat offenders. Must run before the limiter so bans apply everywhere.
app.use(scannerTrap);

// Rate limiter (auth endpoints get a stricter, dedicated one below)
app.use(limiter);

// Per-email login lockout — spoof-proof brute-force guard for credentials.
app.use("/api/v1/login", loginLockout);

// Stricter limit for credential endpoints — brute-force targets.
// Must be mounted BEFORE the general routes.
app.use(["/api/v1/login", "/api/v1/register", "/api/v1/google"], authLimiter);

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

export default app;
