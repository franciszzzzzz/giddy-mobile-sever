import { INTENTS } from "../../constants/intents.js";

import greetings from "../dictionaries/greetings.js";
import recommendationWords from "../dictionaries/recommendationWords.js";
import comparisonWords from "../dictionaries/comparisonWords.js";
import educationTopics from "../dictionaries/educationTopics.js";
import storeTopics from "../dictionaries/storeTopics.js";

export default function classifyIntent(message) {
  const text = message.toLowerCase();

  if (greetings.some((word) => text.includes(word))) {
    return INTENTS.GREETING;
  }

  if (comparisonWords.some((word) => text.includes(word))) {
    return INTENTS.PRODUCT_COMPARISON;
  }

  if (recommendationWords.some((word) => text.includes(word))) {
    return INTENTS.PRODUCT_RECOMMENDATION;
  }

  // Shopping/search requests
  const shoppingWords = [
    "show",
    "find",
    "search",
    "looking for",
    "i want",
    "need",
    "browse",
    "see",
    "buy",
    "have",
  ];

  if (shoppingWords.some((word) => text.includes(word))) {
    return INTENTS.PRODUCT_SEARCH;
  }

  // Education only when the user is asking to learn
  if (
    educationTopics.some((word) => text.includes(word)) &&
    (text.includes("what is") ||
      text.includes("what are") ||
      text.includes("how") ||
      text.includes("why") ||
      text.includes("difference") ||
      text.includes("explain"))
  ) {
    return INTENTS.FRAGRANCE_EDUCATION;
  }

  if (storeTopics.some((word) => text.includes(word))) {
    return INTENTS.STORE_INFORMATION;
  }

  return INTENTS.PRODUCT_SEARCH;
}
