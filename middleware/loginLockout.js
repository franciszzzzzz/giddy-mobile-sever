// middleware/loginLockout.js
import redisClient from "../config/redis.js";

// 8 failed logins for one email within 15 minutes -> email locked 15 minutes.
// Keyed on the EMAIL, not the IP: X-Forwarded-For identities can be rotated
// by an attacker, but the account being hammered stays the same, so this
// guard holds even when identity is client-supplied.
const MAX_FAILURES = 8;
const WINDOW_SECONDS = 15 * 60;
const LOCK_SECONDS = 15 * 60;

const failKey = (email) => `loginlock:fail:${email}`;
const lockKey = (email) => `loginlock:locked:${email}`;

/**
 * Mounted on /api/v1/login (after express.json, so req.body is parsed).
 * Blocks logins for a locked email and counts failures per email.
 * Fail-open on Redis errors — a Redis outage must not lock users out.
 */
export const loginLockout = async (req, res, next) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : null;

  // No email to key on (e.g. malformed request) — let the route validate it.
  if (!email) return next();

  const locked = await redisClient.exists(lockKey(email));
  if (locked) {
    return res.status(429).json({
      success: false,
      message:
        "Too many failed attempts. Please wait a few minutes before trying again.",
      retryAfter: LOCK_SECONDS,
    });
  }

  // Watch the response: 401 = failed login (count it), 2xx = success (reset).
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 401) {
      recordFailure(email).catch(() => {});
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      redisClient.del(failKey(email)).catch(() => {});
    }
    return originalJson(body);
  };

  next();
};

async function recordFailure(email) {
  const fKey = failKey(email);

  const count = await redisClient.incr(fKey);
  if (count === 1) {
    await redisClient.expire(fKey, WINDOW_SECONDS);
  }

  if (count >= MAX_FAILURES) {
    await redisClient.setEx(lockKey(email), LOCK_SECONDS, String(Date.now()));
    await redisClient.del(fKey);
    console.log(
      `🔒 Login locked for ${email} (${LOCK_SECONDS / 60}m) after ${count} failed attempts`,
    );
  }
}
