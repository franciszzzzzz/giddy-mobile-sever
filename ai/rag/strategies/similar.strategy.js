import formatter from "../productFormatter.js";
import { retrieveContext } from "../retrieval.service.js";

/**
 * Similar Products Strategy
 *
 * Retrieves products related to the currently
 * selected product using the shared retrieval pipeline.
 */
async function execute(intent) {
  const context = await retrieveContext(intent);

  return {
    source: "similar",

    products: formatter.formatProducts(context.products || []),

    product: context.product ? formatter.formatProduct(context.product) : null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
