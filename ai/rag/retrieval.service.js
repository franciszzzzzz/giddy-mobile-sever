import strategies from "./strategies/index.js";
import logger from "../../utils/logger.js";

/**
 * Retrieves context for Claire.
 */
export async function retrieveContext(intent) {
  try {
    //
    // --------------------------------------------------
    // If memory has already resolved a specific product,
    // return it immediately.
    // --------------------------------------------------
    //
    if (intent.product) {
      return {
        source: "memory",

        products: [intent.product],

        product: intent.product,

        brands: intent.product.brand ? [intent.product.brand] : [],

        categories: intent.product.categories || [],
      };
    }

    //
    // --------------------------------------------------
    // Otherwise use the normal retrieval strategy.
    // --------------------------------------------------
    //
    const strategy = strategies[intent.type];

    console.log("INTENT TYPE:", intent.type);
    console.log("STRATEGY:", strategy);

    if (!strategy) {
      logger.warn({
        intent: intent.type,
        message: "No retrieval strategy registered.",
      });

      return {
        source: null,

        products: [],

        product: null,

        brands: [],

        categories: [],
      };
    }

    return await strategy.execute(intent);
  } catch (error) {
    logger.error({
      intent: intent.type,
      message: "Retrieval failed.",
      error: error.message,
      stack: error.stack,
    });

    return {
      source: "error",

      products: [],

      product: null,

      brands: [],

      categories: [],

      error: error.message,
    };
  }
}

export default {
  retrieveContext,
};
