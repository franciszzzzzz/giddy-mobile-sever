import aiProductService from "../../../services/aiProduct.service.js";
import productTypes from "../../agent/dictionaries/productTypes.js";

export default async function searchByProductType(intent = {}) {
  if (!intent.productType) {
    return [];
  }

  const aliases = productTypes[intent.productType];

  if (!aliases?.length) {
    return [];
  }

  // Search using the primary alias
  return aiProductService.searchProducts(aliases[0], {
    page: 1,
    limit: 50,
  });
}
