import { wc } from "../../../config/db.js";
import logger from "../../../utils/logger.js";

/**
 * Executes a WooCommerce product search.
 *
 * This is the single gateway for retrieving products
 * from WooCommerce.
 *
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
export default async function searchProducts(filters = {}) {
  try {
    const response = await wc.get("/products", {
      params: {
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
      },
    });

    logger.info({
      message: "WooCommerce products retrieved.",
      filters,
      count: response.data.length,
    });

    return response.data;
  } catch (error) {
    logger.error({
      message: "WooCommerce product retrieval failed.",
      filters,
      error: error.message,
    });

    return [];
  }
}
