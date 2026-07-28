import aiProductService from "../../../services/aiProduct.service.js";

/**
 * Retrieves featured products.
 *
 * Accepts the entire intent object for consistency
 * with every other retrieval strategy.
 */
export default async function searchFeaturedProducts(intent = {}) {
  if (!intent.featured) {
    return [];
  }

  return aiProductService.getFeaturedProducts(50);
}
