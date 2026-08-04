/**
 * Conversation Strategy
 *
 * Used for non-product intents (GREETING, FRAGRANCE_EDUCATION,
 * STORE_INFORMATION, UNKNOWN).
 *
 * These intents are conversational and must NEVER trigger product
 * retrieval or show product cards. Returning empty context keeps the
 * response focused on the conversation (a greeting, an educational
 * answer, store info) instead of attaching unrelated products.
 *
 * Without this strategy, getStrategy() falls back to PRODUCT_SEARCH for
 * unmapped intents, which retrieves products for greetings like "hey".
 */
async function execute() {
  return {
    source: "conversation",

    products: [],

    product: null,

    brands: [],

    categories: [],
  };
}

export default {
  execute,
};
