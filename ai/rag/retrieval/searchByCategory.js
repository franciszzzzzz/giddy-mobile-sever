import aiProductService from "../../../services/aiProduct.service.js";

/**
 * Retrieves products from a category group.
 *
 * Examples:
 * - women
 * - men
 * - kids
 * - gift-set
 * - unisex
 * - diffuser
 * - scented-candle
 * - hair-care
 *
 * Accepts the entire intent object.
 */
export default async function searchByCategory(intent = {}) {
  if (!intent.categoryGroup?.slug) {
    return [];
  }

  return aiProductService.getProductsByGroup(intent.categoryGroup.slug);
}
