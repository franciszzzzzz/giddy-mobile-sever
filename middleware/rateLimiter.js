// middleware/rateLimiter.js
import rateLimit from "express-rate-limit";

/**
 * Paths that must NEVER be rate limited by the global limiter:
 * - health: used by the app's wake-up pings (3 requests on every cold start)
 * - refresh-token / logout: a 429 here is indistinguishable from an invalid
 *   token on the client and logs the user out. The refresh token itself is
 *   a 64-byte random secret, so abuse potential is negligible.
 */
const UNLIMITED_PATHS = [
  "/api/v1/health",
  "/api/v1/refresh-token",
  "/api/v1/logout",
];

const skipUnlimited = (req) =>
  req.method === "OPTIONS" || UNLIMITED_PATHS.includes(req.path);

/**
 * Global API limiter.
 *
 * Kept generous: mobile carriers put many users behind a single public IP
 * (CGNAT), so a tight per-IP limit is effectively shared across strangers.
 * The app also bursts (catalog, cart, wishlist) right after launch.
 */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipUnlimited,
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
      retryAfter: 60,
    });
  },
});

/**
 * Stricter limiter for credential endpoints (brute-force targets).
 * Mounted on /login, /register and /google in app.js.
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  handler: (req, res) => {
    console.log(`🚫 Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many attempts, please try again in a minute.",
      retryAfter: 60,
    });
  },
});

export default limiter;
export { authLimiter };
