import aiProductService from "../../../services/aiProduct.service.js";

/**
 * Performs a keyword search against WooCommerce.
 *
 * Uses the original user query.
 *
 * Accepts the entire intent object.
 */
export default async function searchByKeyword(intent = {}) {
  if (!intent.query?.trim()) {
    return [];
  }

  return aiProductService.searchProducts(intent.query, {
    page: 1,
    limit: 50,
  });
}
