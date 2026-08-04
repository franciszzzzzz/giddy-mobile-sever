import productSearch from "./productSearch.strategy.js";
import recommendation from "./recommendation.strategy.js";
import comparison from "./comparison.strategy.js";
import information from "./information.strategy.js";
import category from "./category.strategy.js";
import similar from "./similar.strategy.js";
import featured from "./featured.strategy.js";
import productOfWeek from "./productOfWeek.strategy.js";
import brands from "./brands.strategy.js";
import categories from "./categories.strategy.js";
import followUpStrategy from "./followUp.strategy.js";
import conversation from "./conversation.strategy.js";

import { INTENTS } from "../../constants/intents.js";

const strategies = {
  [INTENTS.PRODUCT_SEARCH]: productSearch,

  [INTENTS.PRODUCT_RECOMMENDATION]: recommendation,

  [INTENTS.PRODUCT_COMPARISON]: comparison,

  [INTENTS.PRODUCT_INFORMATION]: information,

  [INTENTS.CATEGORY]: category,

  [INTENTS.SIMILAR_PRODUCTS]: similar,

  [INTENTS.FEATURED_PRODUCTS]: featured,

  [INTENTS.PRODUCT_OF_THE_WEEK]: productOfWeek,

  [INTENTS.BRANDS]: brands,

  [INTENTS.CATEGORIES]: categories,

  [INTENTS.FOLLOW_UP]: followUpStrategy,

  //
  // Non-product intents are conversational: they must NOT retrieve or show
  // products. Maps to the no-op conversation strategy so greetings,
  // education answers and store info never attach product cards.
  //
  [INTENTS.GREETING]: conversation,

  [INTENTS.FRAGRANCE_EDUCATION]: conversation,

  [INTENTS.STORE_INFORMATION]: conversation,

  [INTENTS.UNKNOWN]: conversation,
};

/**
 * Returns the appropriate strategy.
 * Falls back to PRODUCT_SEARCH.
 */
export function getStrategy(intentType) {
  return strategies[intentType] || strategies[INTENTS.PRODUCT_SEARCH];
}

export default strategies;
