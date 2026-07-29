import formatter from "../productFormatter.js";
import { retrieve } from "../retrieval.service.js";

/**
 * Product of the Week Strategy
 *
 * Retrieves the current product of the week
 * using the shared retrieval pipeline.
 */
async function execute(intent) {
  const context = await retrieve({
    ...intent,
    productOfWeek: true,
  });

  return {
    source: "product_of_the_week",

    products: [],

    product: context.product
      ? formatter.formatProduct(context.product)
      : context.products?.length
        ? formatter.formatProduct(context.products[0])
        : null,

    brands: context.brands || [],

    categories: context.categories || [],
  };
}

export default {
  execute,
};
