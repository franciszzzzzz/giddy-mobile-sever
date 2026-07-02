// middleware/cache.js
import redisClient from "../config/redis.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";

export const cache = (ttl = CACHE_TTL.PRODUCTS) => {
  return async (req, res, next) => {
    const key = req.originalUrl;

    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip cache for specific paths
    if (req.path.includes("/auth") || req.path.includes("/admin")) {
      return next();
    }

    try {
      const cached = await redisClient.get(key);

      if (cached) {
        console.log("🟢 Cache HIT:", key);
        const parsedData = JSON.parse(cached);
        return res.json({
          ...parsedData,
          _cached: true,
          _cachedAt: parsedData._cachedAt,
        });
      }

      console.log("🟡 Cache MISS:", key);

      const originalJson = res.json;
      res.json = function (data) {
        if (data && data.success !== false && !data.error) {
          const dataToCache = {
            ...data,
            _cachedAt: new Date().toISOString(),
          };

          redisClient
            .setEx(key, ttl, JSON.stringify(dataToCache))
            .then(() => console.log(`✅ Cached: ${key}`))
            .catch((err) => console.log(`❌ Cache error: ${err.message}`));
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (err) {
      console.log("❌ Cache middleware error:", err.message);
      next();
    }
  };
};

// ADD THIS: cacheDebugger export that was missing
export const cacheDebugger = async (req, res, next) => {
  const key = req.originalUrl;

  // Only log for API routes
  if (key.includes("/api/") || key.includes("/products")) {
    console.log(`\n🔍 [CACHE DEBUG] ${req.method} ${key}`);

    try {
      const health = await redisClient.healthCheck();
      console.log(
        `🔍 [CACHE DEBUG] Redis health: ${
          health.healthy ? "🟢 Healthy" : "🔴 Unhealthy"
        }`,
      );

      if (req.method === "GET" && health.healthy) {
        const cached = await redisClient.get(key);
        console.log(
          `🔍 [CACHE DEBUG] Cache status: ${cached ? "🟢 HIT" : "🟡 MISS"}`,
        );
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log(`🔍 [CACHE DEBUG] Cached at: ${parsed._cachedAt}`);
        }
      }
    } catch (err) {
      console.log(`🔍 [CACHE DEBUG] Redis check failed: ${err.message}`);
    }
  }

  next();
};

export const cacheHealth = async (req, res) => {
  try {
    const health = await redisClient.healthCheck();
    res.json({
      success: true,
      cache: health,
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const clearCache = async (req, res) => {
  try {
    // ✅ Use flushAll instead of keys
    await redisClient.flushAll();
    console.log("✅ Cache cleared manually via FLUSHALL");
    res.json({
      success: true,
      message: "Cache cleared successfully",
    });
  } catch (err) {
    console.log("❌ Clear cache failed:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to clear cache",
    });
  }
};
