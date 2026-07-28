import buildWooFilters from "../helpers/buildWooFilters.js";
import searchProducts from "./searchProducts.js";

/**
 * Retrieves products matching a product type.
 *
 * Examples:
 * - perfume
 * - body_mist
 * - body_spray
 * - perfume_oil
 * - diffuser
 * - candle
 *
 * @param {Object} intent
 * @returns {Promise<Array>}
 */
export default async function searchByProductType(intent = {}) {
  //
  // -----------------------------------
  // No product type?
  // -----------------------------------
  //
  if (!intent.productType) {
    return [];
  }

  //
  // -----------------------------------
  // Build WooCommerce filters
  // -----------------------------------
  //
  const filters = buildWooFilters(intent);

  //
  // -----------------------------------
  // Retrieve products
  // -----------------------------------
  return await searchProducts(filters);
}
