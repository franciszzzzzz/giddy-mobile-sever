import { wc } from "../../../config/db.js";

import getBrands from "./getBrands.js";
import resolveFuzzyValue from "../helpers/resolveFuzzyValue.js";

/**
 * Retrieves all products belonging to a brand.
 *
 * @param {string} brand
 * @returns {Promise<Array>}
 */
export default async function getProductsByBrand(brand) {
  if (!brand) {
    return [];
  }

  //
  // ------------------------------------
  // Get all available brands
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
    brand,
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
  // Retrieve products
  // ------------------------------------
  //
  const response = await wc.get("/products", {
    params: {
      tag: matchedBrand.id,
      per_page: 100,
    },
  });

  return response.data;
}
