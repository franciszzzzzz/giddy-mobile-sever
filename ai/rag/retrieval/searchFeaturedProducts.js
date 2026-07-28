import buildWooFilters from "../helpers/buildWooFilters.js";
import searchProducts from "./searchProducts.js";

/**
 * Retrieves featured products.
 *
 * @param {Object} intent
 * @returns {Promise<Array>}
 */
export default async function searchFeaturedProducts(intent = {}) {
  //
  // -----------------------------------------
  // Build filters
  // -----------------------------------------
  //
  const filters = buildWooFilters({
    ...intent,
    featured: true,
  });

  //
  // -----------------------------------------
  // Retrieve products
  // -----------------------------------------
  //
  return await searchProducts(filters);
}
