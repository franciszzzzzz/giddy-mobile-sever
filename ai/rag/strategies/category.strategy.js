import formatter from "../productFormatter.js";
import { retrieve } from "../retrieval.service.js";

/**
 * Category Strategy
 *
 * Retrieves products belonging to a category or
 * category group using the shared RAG retrieval layer.
 */
async function execute(intent) {
  const context = await retrieve(intent);

  return {
    source: "category",

    products: formatter.formatProducts(context.products || []),

    product: context.product ? formatter.formatProduct(context.product) : null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
