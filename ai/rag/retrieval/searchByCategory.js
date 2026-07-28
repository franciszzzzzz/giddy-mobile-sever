import buildWooFilters from "../helpers/buildWooFilters.js";
import mergeProducts from "../helpers/mergeProducts.js";
import removeDuplicates from "../helpers/removeDuplicates.js";

import getCategoryGroup from "../taxonomy/getCategoryGroup.js";

import searchProducts from "./searchProducts.js";

/**
 * Retrieves all products belonging to a category group.
 *
 * Examples:
 * - women
 * - men
 * - kids
 * - gift-set
 * - diffuser
 * - scented-candle
 * - hair-care
 *
 * @param {Object} intent
 * @returns {Promise<Array>}
 */
export default async function searchByCategory(intent = {}) {
  //
  // -----------------------------------------
  // No category?
  // -----------------------------------------
  //
  if (!intent.category) {
    return [];
  }

  //
  // -----------------------------------------
  // Get every category ID belonging to the group
  // -----------------------------------------
  //
  const categoryIds = await getCategoryGroup(intent.category.slug);

  if (!categoryIds.length) {
    return [];
  }

  //
  // -----------------------------------------
  // Retrieve products from every category
  // -----------------------------------------
  //
  const responses = await Promise.all(
    categoryIds.map((categoryId) => {
      const filters = buildWooFilters({
        ...intent,
        category: categoryId,
      });

      return searchProducts(filters);
    }),
  );

  //
  // -----------------------------------------
  // Merge results
  // -----------------------------------------
  //
  const merged = mergeProducts(...responses);

  //
  // -----------------------------------------
  // Remove duplicates
  // -----------------------------------------
  //
  return removeDuplicates(merged);
}
