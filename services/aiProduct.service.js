import { wc } from "../config/db.js";
import logger from "../utils/logger.js";
import { getCache, setCache, CACHE_TTL } from "../utils/cacheUtils.js";
import redisClient from "../config/redis.js";

import resolveFuzzyValue from "../ai/rag/helpers/resolveFuzzyValue.js";

/**
 * Creates consistent cache keys.
 */
const buildCacheKey = (prefix, data = {}) => {
  return `ai:${prefix}:${JSON.stringify(data)}`;
};

/**
 * Returns true when a retrieval result should be treated as an "empty" hit
 * (no products, missing item) and cached for the short negative window.
 */
function isEmptyResult(data) {
  return (
    data == null ||
    data === "" ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === "object" && Object.keys(data).length === 0)
  );
}

/**
 * Generic cache wrapper.
 *
 * Empty results (no products, missing item) are cached for the short negative
 * window (CACHE_TTL.NEGATIVE) instead of the full TTL. This prevents a
 * known-empty lookup from hammering WooCommerce on retries while still letting
 * catalog fixes / re-tags appear within a minute rather than sticking for an
 * hour.
 *
 * Key presence is checked directly against Redis so a cached empty value
 * (including null) is served as a hit — without this, JSON.parse("null") would
 * round-trip back to null and look like a miss, defeating the negative cache.
 *
 * Thrown errors are never cached — a WooCommerce outage must not freeze in.
 */
async function withCache(cacheKey, ttl, fetcher) {
  //
  // ------------------------------------
  // Read-through: serve any existing entry, including empty ones
  // ------------------------------------
  //
  const exists = await redisClient.exists(cacheKey);

  if (exists) {
    const cached = await getCache(cacheKey);

    logger.info(`AI Cache Hit -> ${cacheKey}`);

    return cached;
  }

  logger.info(`AI Cache Miss -> ${cacheKey}`);

  //
  // ------------------------------------
  // Fetch from source
  // ------------------------------------
  //
  const data = await fetcher();

  //
  // ------------------------------------
  // Negative cache empties briefly; positive results get the full TTL
  // ------------------------------------
  //
  const effectiveTtl = isEmptyResult(data) ? CACHE_TTL.NEGATIVE : ttl;

  await setCache(cacheKey, data, effectiveTtl);

  return data;
}

/**
 * Search products by keyword.
 */
export async function searchProducts(query, options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 10;

  const cacheKey = buildCacheKey("search", {
    query,
    page,
    limit,
  });

  return withCache(cacheKey, CACHE_TTL.PRODUCTS, async () => {
    const response = await wc.get("/products", {
      params: {
        search: query,
        page,
        per_page: limit,
      },
    });

    return response.data;
  });
}

/**
 * Get a single WooCommerce product.
 */
export async function getProduct(productId) {
  const cacheKey = buildCacheKey("product", {
    productId,
  });

  return withCache(cacheKey, CACHE_TTL.PRODUCT, async () => {
    const response = await wc.get(`/products/${productId}`);

    return response.data;
  });
}

/**
 * Get products similar to another product.
 *
 * Temporary until searchSimilarProducts.js
 * is implemented in the RAG retrieval layer.
 */
export async function getSimilarProducts(productId) {
  const cacheKey = buildCacheKey("similar", {
    productId,
  });

  return withCache(cacheKey, CACHE_TTL.PRODUCTS, async () => {
    const product = await getProduct(productId);

    if (!product?.categories?.length) {
      return [];
    }

    const categoryId = product.categories[0].id;

    const response = await wc.get("/products", {
      params: {
        category: categoryId,
        per_page: 8,
      },
    });

    return response.data.filter((item) => item.id !== product.id).slice(0, 5);
  });
}

/**
 * Retrieve WooCommerce categories.
 */
export async function getCategories() {
  return withCache("ai:categories", CACHE_TTL.CATEGORIES, async () => {
    const response = await wc.get("/products/categories", {
      params: {
        per_page: 100,
      },
    });

    return response.data;
  });
}

/**
 * Retrieve WooCommerce brands (tags).
 */
export async function getBrands() {
  return withCache("ai:brands", CACHE_TTL.BRANDS, async () => {
    const response = await wc.get("/products/tags", {
      params: {
        per_page: 100,
      },
    });

    return response.data;
  });
}

/**
 * Retrieve products belonging to a brand.
 *
 * Fuzzy-matches the brand name against all WooCommerce tags,
 * then fetches products with the matched tag ID.
 *
 * @param {string} brandName
 * @returns {Promise<Array>}
 */
export async function getProductsByBrand(brandName) {
  if (!brandName) {
    return [];
  }

  const cacheKey = buildCacheKey("productsByBrand", {
    brandName,
  });

  return withCache(cacheKey, CACHE_TTL.PRODUCTS, async () => {
    //
    // ------------------------------------
    // Get all available brands (tags)
    // ------------------------------------
    //
    const brands = await getBrands();

    //
    // ------------------------------------
    // Fuzzy match the requested brand
    // ------------------------------------
    //
    const matchedName = resolveFuzzyValue(
      brands.map((item) => item.name),
      brandName,
    );

    if (!matchedName) {
      return [];
    }

    //
    // ------------------------------------
    // Find the WooCommerce tag
    // ------------------------------------
    //
    const matchedBrand = brands.find((item) => item.name === matchedName);

    if (!matchedBrand) {
      return [];
    }

    //
    // ------------------------------------
    // Retrieve products by tag
    // ------------------------------------
    //
    const response = await wc.get("/products", {
      params: {
        tag: matchedBrand.id,
        per_page: 100,
      },
    });

    return response.data;
  });
}

/**
 * Retrieve products belonging to a category group.
 *
 * A category group (e.g. "women", "men", "kids") maps to
 * a parent category and all its children.
 *
 * @param {string} slug
 * @returns {Promise<Array>}
 */
export async function getProductsByGroup(slug) {
  if (!slug) {
    return [];
  }

  const cacheKey = buildCacheKey("productsByGroup", {
    slug,
  });

  return withCache(cacheKey, CACHE_TTL.PRODUCTS, async () => {
    //
    // ------------------------------------
    // Get all categories
    // ------------------------------------
    //
    const categories = await getCategories();

    const value = slug.toLowerCase();

    let categoryIds = [];

    //
    // ------------------------------------
    // Kids — combine boys + girls
    // ------------------------------------
    //
    if (value === "kids") {
      const boys = categories.find((category) => category.slug === "boys");
      const girls = categories.find((category) => category.slug === "girls");

      const collectChildren = (parent) => {
        if (!parent) {
          return [];
        }

        const children = categories.filter(
          (category) => category.parent === parent.id,
        );

        return [parent.id, ...children.map((child) => child.id)];
      };

      categoryIds = [
        ...new Set([...collectChildren(boys), ...collectChildren(girls)]),
      ];
    } else {
      //
      // ------------------------------------
      // Normal parent category
      // ------------------------------------
      //
      const parent = categories.find(
        (category) =>
          category.parent === 0 && category.slug.toLowerCase() === value,
      );

      if (!parent) {
        return [];
      }

      const children = categories.filter(
        (category) => category.parent === parent.id,
      );

      categoryIds = [parent.id, ...children.map((child) => child.id)];
    }

    if (!categoryIds.length) {
      return [];
    }

    //
    // ------------------------------------
    // Retrieve products from all matching categories
    // ------------------------------------
    //
    const response = await wc.get("/products", {
      params: {
        category: categoryIds.join(","),
        per_page: 100,
      },
    });

    return response.data;
  });
}

/**
 * Retrieve featured products.
 *
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getFeaturedProducts(limit = 50) {
  const cacheKey = buildCacheKey("featured", {
    limit,
  });

  return withCache(cacheKey, CACHE_TTL.PRODUCTS, async () => {
    const response = await wc.get("/products", {
      params: {
        featured: true,
        per_page: limit,
      },
    });

    return response.data;
  });
}

export default {
  searchProducts,
  getProduct,
  getSimilarProducts,
  getCategories,
  getBrands,
  getProductsByBrand,
  getProductsByGroup,
  getFeaturedProducts,
};
