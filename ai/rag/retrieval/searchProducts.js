import { wc } from "../../../config/db.js";

import logger from "../../../utils/logger.js";

import { getCache, setCache, CACHE_TTL } from "../../../utils/cacheUtils.js";

/**
 * Builds a cache key for WooCommerce searches.
 */
function buildCacheKey(filters = {}) {
  return `rag:products:${JSON.stringify(filters)}`;
}

/**
 * Removes undefined and null values before sending
 * the request to WooCommerce.
 */
function cleanFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

/**
 * Executes a WooCommerce product search.
 *
 * Every retrieval strategy eventually comes through here.
 */
export default async function searchProducts(filters = {}) {
  const params = cleanFilters({
    page: filters.page || 1,

    per_page: filters.limit || 50,

    search: filters.search,

    category: filters.category,

    tag: filters.brand,

    featured: filters.featured,

    on_sale: filters.onSale,

    stock_status: filters.stockStatus,

    min_price: filters.minPrice,

    max_price: filters.maxPrice,

    orderby: filters.orderBy,

    order: filters.order,
  });

  const cacheKey = buildCacheKey(params);

  const cached = await getCache(cacheKey);

  if (cached) {
    logger.info({
      message: "RAG cache hit.",
      cacheKey,
    });

    return cached;
  }

  try {
    const response = await wc.get("/products", {
      params,
    });

    await setCache(cacheKey, response.data, CACHE_TTL.PRODUCTS);

    logger.info({
      message: "WooCommerce products retrieved.",
      filters: params,
      count: response.data.length,
    });

    return response.data;
  } catch (error) {
    logger.error({
      message: "WooCommerce retrieval failed.",
      filters: params,
      error: error.message,
    });

    return [];
  }
}
