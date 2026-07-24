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

  if (educationTopics.some((word) => text.includes(word))) {
    return INTENTS.EDUCATION;
  }

  if (storeTopics.some((word) => text.includes(word))) {
    return INTENTS.STORE_SUPPORT;
  }

  return INTENTS.PRODUCT_SEARCH;
}
