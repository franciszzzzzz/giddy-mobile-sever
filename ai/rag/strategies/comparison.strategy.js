import aiProductService from "../../../services/aiProduct.service.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  // Nothing to compare yet
  if (!Array.isArray(intent.products) || intent.products.length < 2) {
    return {
      source: "comparison",
      products: [],
      product: null,
      brands: [],
      categories: [],
    };
  }

  const products = await Promise.all(
    intent.products.map((id) => aiProductService.getProduct(id)),
  );

  return {
    source: "comparison",
    products: formatter.formatProducts(products.filter(Boolean)),
    product: null,
    brands: [],
    categories: [],
  };
}

export default {
  execute,
};
