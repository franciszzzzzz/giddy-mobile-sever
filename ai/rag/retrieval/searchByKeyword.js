import normalizeSearchTerm from "../helpers/normalizeSearchTerm.js";
import buildWooFilters from "../helpers/buildWooFilters.js";
import searchProducts from "./searchProducts.js";

/**
 * Retrieves products using a keyword search.
 *
 * @param {Object} intent
 * @returns {Promise<Array>}
 */
export default async function searchByKeyword(intent = {}) {
  //
  // -----------------------------------
  // Normalize the user's search
  // -----------------------------------
  //
  const search = normalizeSearchTerm(intent.query);

  //
  // -----------------------------------
  // Build WooCommerce filters
  // -----------------------------------
  //
  const filters = buildWooFilters({
    ...intent,
    search,
  });

  //
  // -----------------------------------
  // Retrieve products
  // -----------------------------------
  return await searchProducts(filters);
}
