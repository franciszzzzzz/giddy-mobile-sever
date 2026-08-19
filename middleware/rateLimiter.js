// middleware/rateLimiter.js
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis.js";

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
 * Resolve a client identity.
 *
 * The container sees every external request as the Docker gateway IP
 * (::ffff:172.18.0.1), so req.ip alone would put ALL users in one bucket —
 * a single scanner then eats everyone's quota. When a proxy sits in front
 * of the app it appends the real client IP to X-Forwarded-For, and the
 * LAST entry is the one added by the nearest proxy (hardest to forge), so
 * we key on that. Without the header we fall back to req.ip.
 *
 * `via` tells downstream middleware where the identity came from — only
 * "xff" identities may ever be banned, because the "direct" fallback
 * (gateway) identity is shared by everyone.
 */
export const resolveIdentity = (req) => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const last = xff.split(",").pop().trim();
    if (last) return { key: last, via: "xff" };
  }
  return { key: req.ip, via: "direct" };
};

// Redis-backed store: limits survive container restarts. Fail-open on Redis
// errors (passOnStoreError) so a Redis outage can never block requests.
const redisStore = () =>
  new RedisStore({
    sendCommand: (...args) => redisClient.client.sendCommand(args),
  });

/**
 * Global API limiter — one bucket per client identity.
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
  store: redisStore(),
  passOnStoreError: true,
  keyGenerator: (req) => resolveIdentity(req).key,
  handler: (req, res) => {
    const id = resolveIdentity(req);
    console.log(
      `🚫 Rate limit exceeded for ${id.key} (via ${id.via}) on ${req.path}`,
    );
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
  store: redisStore(),
  passOnStoreError: true,
  keyGenerator: (req) => resolveIdentity(req).key,
  handler: (req, res) => {
    const id = resolveIdentity(req);
    console.log(`🚫 Auth rate limit exceeded for ${id.key} (via ${id.via})`);
    res.status(429).json({
      success: false,
      message: "Too many attempts, please try again in a minute.",
      retryAfter: 60,
    });
  },
});

export default limiter;
export { authLimiter };
