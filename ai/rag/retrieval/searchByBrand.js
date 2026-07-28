import aiProductService from "../../../services/aiProduct.service.js";

/**
 * Retrieves products belonging to a brand.
 *
 * Accepts the entire intent object.
 */
export default async function searchByBrand(intent = {}) {
  if (!intent.brand?.name) {
    return [];
  }

  return aiProductService.getProductsByBrand(intent.brand.name);
}
