import { wc } from "../../../config/db.js";

import getProduct from "./getProduct.js";

/**
 * Retrieves products similar to a given product.
 *
 * Similarity is currently based on the first category
 * the product belongs to.
 *
 * @param {number|string} productId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export default async function getSimilarProducts(productId, limit = 5) {
  if (!productId) {
    return [];
  }

  //
  // -----------------------------------
  // Retrieve the source product
  // -----------------------------------
  //
  const product = await getProduct(productId);

  if (!product) {
    return [];
  }

  //
  // -----------------------------------
  // Product must belong to a category
  // -----------------------------------
  //
  if (!product.categories?.length) {
    return [];
  }

  const categoryId = product.categories[0].id;

  //
  // -----------------------------------
  // Retrieve products from same category
  // -----------------------------------
  //
  const response = await wc.get("/products", {
    params: {
      category: categoryId,
      per_page: limit + 1,
    },
  });

  //
  // -----------------------------------
  // Remove the original product
  // -----------------------------------
  //
  return response.data.filter((item) => item.id !== product.id).slice(0, limit);
}
