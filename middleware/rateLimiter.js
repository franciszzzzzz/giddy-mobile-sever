// middleware/rateLimiter.js
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Using default memory store - no Redis dependency
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
      retryAfter: 60,
    });
  },
});

export default limiter;
