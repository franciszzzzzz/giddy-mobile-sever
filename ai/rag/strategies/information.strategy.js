import formatter from "../productFormatter.js";
import { retrieveContext } from "../retrieval.service.js";

/**
 * Product Information Strategy
 *
 * Retrieves a specific product (or the closest matching one)
 * using the shared RAG retrieval pipeline.
 */
async function execute(intent) {
  const context = await retrieveContext(intent);

  //
  // --------------------------------------------------
  // If memory already resolved a specific product
  // --------------------------------------------------
  //

  if (context.product) {
    return {
      source: "information",

      products: [],

      product: formatter.formatProduct(context.product),

      brands: context.brands || [],

      categories: context.categories || [],
    };
  }

  //
  // --------------------------------------------------
  // Otherwise use the first retrieved product
  // --------------------------------------------------
  //

  const product = context.products?.[0] || null;

  return {
    source: "information",

    products: [],

    product: product ? formatter.formatProduct(product) : null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
