import formatter from "../productFormatter.js";
import { retrieve } from "../retrieval.service.js";

/**
 * Product Comparison Strategy
 *
 * Retrieves products using the shared RAG pipeline.
 *
 * Comparison candidates may come from:
 * - Conversation memory
 * - Previous recommendations
 * - Explicit product names
 * - Search results
 */
async function execute(intent) {
  const context = await retrieve(intent);

  //
  // --------------------------------------------------
  // Products already resolved by retrieval/memory
  // --------------------------------------------------
  //

  const products = context.products || [];

  //
  // --------------------------------------------------
  // Need at least two products to compare
  // --------------------------------------------------
  //

  if (products.length < 2) {
    return {
      source: "comparison",

      products: [],

      product: null,

      brands: context.brands || [],

      categories: context.categories || [],
    };
  }

  return {
    source: "comparison",

    products: formatter.formatProducts(products),

    product: null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
