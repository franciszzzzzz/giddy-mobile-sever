import formatter from "../productFormatter.js";
import { retrieveContext } from "../retrieval.service.js";

/**
 * Brand Strategy
 *
 * Retrieves products for a brand using the shared
 * RAG retrieval pipeline.
 */
async function execute(intent) {
  const context = await retrieveContext(intent);

  return {
    source: "brand",

    products: formatter.formatProducts(context.products || []),

    product: context.product ? formatter.formatProduct(context.product) : null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
