import aiProductService from "../../../services/aiProduct.service.js";

/**
 * Retrieves products belonging to a product type.
 *
 * Examples:
 * - perfume
 * - body_mist
 * - perfume_oil
 * - deodorant
 * - shampoo
 * - conditioner
 * - diffuser
 * - candle
 *
 * Accepts the entire intent object.
 */
export default async function searchByProductType(intent = {}) {
  if (!intent.productType) {
    return [];
  }

  return aiProductService.getProductsByProductType(intent.productType);
}
