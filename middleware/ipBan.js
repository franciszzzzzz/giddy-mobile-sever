// middleware/ipBan.js
import redisClient from "../config/redis.js";
import { resolveIdentity } from "./rateLimiter.js";

// 10 junk-path requests within 10 minutes -> 1 hour ban for that identity.
const TRAP_THRESHOLD = 10;
const TRAP_WINDOW_SECONDS = 10 * 60;
const BAN_SECONDS = 60 * 60;

const banKey = (key) => `banned:${key}`;
const trapKey = (key) => `trap:${key}`;

/**
 * Mounted first on every request: identities that hit the scanner trap
 * get an instant 403 until their ban expires. Fail-open on Redis errors.
 */
export const checkIpBan = async (req, res, next) => {
  const id = resolveIdentity(req);

  const banned = await redisClient.exists(banKey(id.key));
  if (banned) {
    console.log(
      `🚫 Banned identity ${id.key} (via ${id.via}) blocked on ${req.path}`,
    );
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  next();
};

/**
 * Scanner trap: the app only serves /api/* — anything else (.env probes,
 * .git/config, phpinfo, etc.) is bot noise. Count junk paths per identity
 * and ban the identity once it crosses the threshold.
 *
 * SAFETY RULE: only "xff" identities (from X-Forwarded-For) can be banned.
 * The "direct" fallback is the Docker gateway IP shared by EVERY client —
 * banning it would take the whole API down for all users, so it is never
 * banned (its junk traffic just 404s, exactly like before).
 */
export const scannerTrap = (req, res, next) => {
  if (req.method !== "OPTIONS" && !req.path.startsWith("/api/")) {
    handleTrap(req).catch(() => {}); // fire-and-forget, never block the request
  }
  next();
};

async function handleTrap(req) {
  const id = resolveIdentity(req);
  const tKey = trapKey(id.key);

  const count = await redisClient.incr(tKey);
  if (count === 1) {
    await redisClient.expire(tKey, TRAP_WINDOW_SECONDS);
  }

  if (count === TRAP_THRESHOLD) {
    if (id.via === "xff") {
      await redisClient.setEx(banKey(id.key), BAN_SECONDS, String(Date.now()));
      console.log(
        `🔒 Identity ${id.key} banned for 1h — scanner pattern (${count} junk paths)`,
      );
    } else {
      console.log(
        `⚠️ Scanner pattern from shared identity ${id.key} (${count} junk paths) — not banned (shared-gateway safety)`,
      );
    }
  }
}
