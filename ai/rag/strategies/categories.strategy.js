import { retrieve } from "../retrieval.service.js";

/**
 * Category Strategy
 *
 * Returns category information using the shared
 * retrieval pipeline.
 */
async function execute(intent) {
  const context = await retrieve(intent);

  return {
    source: "categories",

    products: context.products || [],

    product: context.product || null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
