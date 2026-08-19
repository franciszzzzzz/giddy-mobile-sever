// middleware/ipBan.js
import redisClient from "../config/redis.js";
import { resolveIdentity } from "./rateLimiter.js";

// 10 junk-path requests within 10 minutes -> escalating ban for that identity.
const TRAP_THRESHOLD = 10;
const TRAP_WINDOW_SECONDS = 10 * 60;

// Incremental ban ladder: repeat offenders get progressively longer bans.
// 1st offense: 1 hour, 2nd: 1 day, 3rd and beyond: 1 week.
// Offense history is forgotten after 30 clean days (TTL refreshed per offense).
const BAN_LADDER_SECONDS = [
  60 * 60, // 1st: 1 hour
  24 * 60 * 60, // 2nd: 1 day
  7 * 24 * 60 * 60, // 3rd+: 1 week
];
const BAN_HISTORY_SECONDS = 30 * 24 * 60 * 60;

const banKey = (key) => `banned:${key}`;
const trapKey = (key) => `trap:${key}`;
const banCountKey = (key) => `bancount:${key}`;

const formatDuration = (seconds) =>
  seconds >= 24 * 60 * 60
    ? `${seconds / (24 * 60 * 60)}d`
    : seconds >= 60 * 60
      ? `${seconds / (60 * 60)}h`
      : `${seconds / 60}m`;

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
      // Incremental ban: escalate 1h -> 24h -> 7d based on how many times
      // this identity has been banned before.
      const cKey = banCountKey(id.key);
      const offenses = await redisClient.incr(cKey);
      if (offenses >= 1) {
        await redisClient.expire(cKey, BAN_HISTORY_SECONDS);
        const duration =
          BAN_LADDER_SECONDS[
            Math.min(offenses, BAN_LADDER_SECONDS.length) - 1
          ];
        await redisClient.setEx(banKey(id.key), duration, String(offenses));
        console.log(
          `🔒 Identity ${id.key} banned for ${formatDuration(duration)} (offense #${offenses}) — scanner pattern (${count} junk paths)`,
        );
      }
    } else {
      console.log(
        `⚠️ Scanner pattern from shared identity ${id.key} (${count} junk paths) — not banned (shared-gateway safety)`,
      );
    }
  }
}
