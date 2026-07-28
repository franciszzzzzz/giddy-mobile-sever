import { wc } from "../config/db.js";
import logger from "../utils/logger.js";
import { getCache, setCache, CACHE_TTL } from "../utils/cacheUtils.js";

/**
 * Creates consistent cache keys.
 */
const buildCacheKey = (prefix, data = {}) => {
  return `ai:${prefix}:${JSON.stringify(data)}`;
};

/**
 * Generic cache wrapper.
 */
async function withCache(cacheKey, ttl, fetcher) {
  const cached = await getCache(cacheKey);

  if (cached) {
    logger.info(`AI Cache Hit -> ${cacheKey}`);
    return cached;
  }

  logger.info(`AI Cache Miss -> ${cacheKey}`);

  const data = await fetcher();

  await setCache(cacheKey, data, ttl);

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

export default {
  searchProducts,
  getProduct,
  getSimilarProducts,
  getCategories,
  getBrands,
};
