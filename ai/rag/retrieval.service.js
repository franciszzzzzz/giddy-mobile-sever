import strategies from "./strategies/index.js";

import logger from "../../utils/logger.js";

/**
 * Retrieves product context based on the detected intent.
 *
 * Each strategy is responsible for talking to WooCommerce.
 * RetrievalService simply routes the request.
 */
export async function retrieveContext(intent) {
  try {
    const strategy = strategies[intent.type];

    if (!strategy) {
      logger.warn({
        intent: intent.type,
        message: "No retrieval strategy registered.",
      });

      return {
        success: true,

        context: null,
      };
    }

    const context = await strategy.execute(intent);

    return {
      success: true,

      context,
    };
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      intent: intent.type,
      message: "Retrieval failed.",
    });

    return {
      success: false,

      error: error.message,
    };
  }
}

export default {
  retrieveContext,
};
