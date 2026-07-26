import aiProductService from "../../../services/aiProduct.service.js";
import { buildFilters } from "../productFilterBuilder.js";
import { rankProducts } from "../productRanker.js";
import formatter from "../productFormatter.js";

async function execute(intent) {
  // Build WooCommerce filters
  const filters = await buildFilters(intent);

  // Retrieve products
  let products = await aiProductService.findProducts(filters);

  // Rank them according to the user's intent
  products = rankProducts(products, intent);

  // Return only the top results
  return {
    source: "recommendation",
    products: formatter.formatProducts(products.slice(0, 10)),
    product: null,
    brands: [],
    categories: [],
  };
}

export default {
  execute,
};
