import buildWooFilters from "../helpers/buildWooFilters.js";
import searchProducts from "./searchProducts.js";

/**
 * Retrieves all products belonging to a brand.
 *
 * @param {Object} intent
 * @returns {Promise<Array>}
 */
export default async function searchByBrand(intent = {}) {
  //
  // -----------------------------------
  // No brand?
  // -----------------------------------
  //
  if (!intent.brand) {
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
