import formatter from "../productFormatter.js";
import { retrieveContext } from "../retrieval.service.js";

/**
 * Featured Products Strategy
 *
 * Retrieves featured products using the shared
 * RAG retrieval pipeline.
 */
async function execute(intent) {
  const context = await retrieveContext({
    ...intent,
    featured: true,
  });

  return {
    source: "featured",

    products: formatter.formatProducts(context.products || []),

    product: context.product ? formatter.formatProduct(context.product) : null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
