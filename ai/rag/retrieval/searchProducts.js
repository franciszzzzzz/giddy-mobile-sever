import { wc } from "../../../config/db.js";

import logger from "../../../utils/logger.js";

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

  try {
    const response = await wc.get("/products", {
      params,
    });

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
