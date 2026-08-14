// utils/cacheUtils.js
import redisClient from "../config/redis.js";

export const clearProductsCache = async () => {
  console.log("🔄 [CACHE CLEAR] ===== STARTING PRODUCTS CACHE CLEARANCE =====");

  try {
    // Try ALL possible patterns that might match
    const patterns = [
      "/api/v1/products*", // This should match your actual key
      "*/api/v1/products*", // Backup pattern
      "api/v1/products*", // Another variation
      "*products*", // Catch-all for products
      "/api/v1/products?*", // Match with query parameters
    ];

    let allKeys = [];

    console.log(
      "🔍 [CACHE CLEAR] Testing patterns against actual Redis keys...",
    );
    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      console.log(`   Pattern "${pattern}": ${keys.length} keys`);
      if (keys.length > 0) {
        allKeys = [...allKeys, ...keys];
        keys.forEach((key) => console.log(`      - "${key}"`));
      }
    }

    // Remove duplicates
    const uniqueKeys = [...new Set(allKeys)];

    console.log("📊 [CACHE CLEAR] Total unique keys found:", uniqueKeys.length);

    if (uniqueKeys.length > 0) {
      console.log("🗑️ [CACHE CLEAR] Deleting keys:", uniqueKeys);
      const result = await redisClient.del(uniqueKeys);
      console.log("✅ [CACHE CLEAR] SUCCESS: Cleared", result, "cache keys");
      return result;
    } else {
      console.log("🟡 [CACHE CLEAR] No cache keys found with any pattern");
      console.log("💡 [CACHE CLEAR] Let's see ALL keys in Redis to debug:");

      // Show ALL keys to understand the pattern
      const allRedisKeys = await redisClient.keys("*");
      console.log("   All Redis keys:", allRedisKeys);

      return 0;
    }
  } catch (err) {
    console.log("❌ [CACHE CLEAR] ERROR:", err.message);
    throw err;
  } finally {
    console.log("🔚 [CACHE CLEAR] ===== COMPLETED =====");
  }
};

// Add to utils/cacheUtils.js
export const debugAllCacheKeys = async () => {
  console.log("🔍 [CACHE DEBUG] Searching for ALL Redis keys...");
  try {
    const allKeys = await redisClient.keys("*");
    console.log("📋 [CACHE DEBUG] All Redis keys found:");

    if (allKeys.length === 0) {
      console.log("   No keys found in Redis");
    } else {
      allKeys.forEach((key, index) => {
        console.log(`   ${index + 1}. "${key}"`);
      });
    }

    // Also check specific patterns
    const patterns = [
      "*products*",
      "*/api/v1*",
      "/api/v1*",
      "api/v1*",
      "*v1*",
      "*",
    ];

    console.log("🎯 [CACHE DEBUG] Testing different patterns:");
    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      console.log(`   Pattern "${pattern}": ${keys.length} keys`);
      if (keys.length > 0) {
        keys.forEach((key) => console.log(`      - "${key}"`));
      }
    }

    return allKeys;
  } catch (err) {
    console.log("❌ [CACHE DEBUG] Error:", err.message);
    return [];
  }
};

export const getCache = async (key) => {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export const setCache = async (key, value, ttl = 3600) => {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error("Cache Set Error:", error.message);
  }
};

// Refresh-token lifetime in days (config/.env: REFRESH_TOKEN_EXPIRE, default 7).
// The TTL is reset every time the token is used, so this is the max idle time
// before a user is logged out, not the total session length.
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE) || 7;

export const CACHE_TTL = {
  PRODUCTS: 60 * 60, // 1 hour
  PRODUCT: 30 * 60, // 30 minutes
  CATEGORIES: 60 * 60, // 1 hour
  BRANDS: 60 * 60, // 1 hour
  REVIEWS: 10 * 60, // 10 minutes
  REFRESH_TOKEN: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  FEATURED_PRODUCTS: 30 * 60,
  PRODUCT_OF_THE_WEEK: 6 * 60 * 60, // 6 hrs
  WP_TOKEN: 24 * 60 * 60, // 24 hours

  // Short window for caching "empty" results (no products found, missing
  // item). Keeps a known-empty result out of WooCommerce for a minute so a
  // user retry loop can't hammer the API, while still letting catalog fixes
  // or re-tags appear quickly instead of sticking for an hour.
  NEGATIVE: 60, // 1 minute
};
