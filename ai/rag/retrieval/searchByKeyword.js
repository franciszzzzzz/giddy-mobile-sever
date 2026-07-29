import aiProductService from "../../../services/aiProduct.service.js";

/**
 * Performs a keyword search against WooCommerce.
 *
 * Uses the expanded query (conversational filler stripped)
 * if available, falling back to the original query.
 *
 * Accepts the entire intent object.
 */
export default async function searchByKeyword(intent = {}) {
  const query = intent.expandedQuery || intent.query;

  if (!query?.trim()) {
    return [];
  }

  return aiProductService.searchProducts(query, {
    page: 1,
    limit: 50,
  });
}
