import { wc } from "../../../config/db.js";

/**
 * Retrieves a single WooCommerce product.
 *
 * @param {number|string} productId
 * @returns {Promise<Object|null>}
 */
export default async function getProduct(productId) {
  if (!productId) {
    return null;
  }

  try {
    const response = await wc.get(`/products/${productId}`);

    return response.data;
  } catch {
    return null;
  }
}
