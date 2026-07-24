import logger from "../../utils/logger.js";

/**
 * Builds the final response returned to the frontend.
 *
 * @param {Object} options
 * @param {Object} options.intent
 * @param {Object} options.context
 * @param {Object} options.ai
 *
 * @returns {Object}
 */
export default function buildResponse({ intent, context = {}, ai }) {
  try {
    return {
      success: true,

      intent: {
        type: intent.type,
        confidence: intent.confidence ?? 1,
      },

      message: ai.text,

      provider: ai.provider,

      model: ai.model,

      usage: ai.usage,

      context: {
        source: context.source || null,

        products: context.products || [],

        product: context.product || null,

        brands: context.brands || [],

        categories: context.categories || [],
      },

      suggestions: buildSuggestions(intent),

      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(error);

    return {
      success: false,

      message: "Unable to build AI response.",
    };
  }
}

/**
 * Quick replies shown under Claire's response.
 */
function buildSuggestions(intent) {
  switch (intent.type) {
    case "PRODUCT_SEARCH":
      return [
        "Show similar fragrances",
        "What are the notes?",
        "Is it long lasting?",
      ];

    case "PRODUCT_RECOMMENDATION":
      return ["Show more options", "Filter by price", "For men", "For women"];

    case "PRODUCT_INFORMATION":
      return [
        "Compare with another perfume",
        "Show similar products",
        "Available brands",
      ];

    case "PRODUCT_COMPARISON":
      return ["Which lasts longer?", "Which is sweeter?", "Which is stronger?"];

    case "BRANDS":
      return ["Show perfumes", "Best seller", "Newest arrivals"];

    case "CATEGORIES":
      return ["Show products", "Top rated", "Best sellers"];

    default:
      return ["Recommend a perfume", "Browse brands", "Browse categories"];
  }
}
