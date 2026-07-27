import redis from "../../config/redis.js";
import logger from "../../utils/logger.js";

const CACHE_PREFIX = "claire:response";

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours

function buildRedisKey(key) {
  return `${CACHE_PREFIX}:${key}`;
}

async function get(key) {
  try {
    const value = await redis.get(buildRedisKey(key));

    if (!value) {
      return null;
    }

    logger.info({
      message: "AI Cache Hit",
      key,
    });

    return JSON.parse(value);
  } catch (error) {
    logger.warn({
      message: "AI Cache Read Failed",
      error: error.message,
    });

    return null;
  }
}

async function set(key, value, ttl = DEFAULT_TTL) {
  try {
    await redis.setEx(buildRedisKey(key), ttl, JSON.stringify(value));

    logger.info({
      message: "AI Cache Stored",
      key,
    });
  } catch (error) {
    logger.warn({
      message: "AI Cache Store Failed",
      error: error.message,
    });
  }
}

export default {
  get,
  set,
};
