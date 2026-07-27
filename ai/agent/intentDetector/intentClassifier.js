import { INTENTS } from "../../constants/intents.js";

import greetings from "../dictionaries/greetings.js";
import recommendationWords from "../dictionaries/recommendationWords.js";
import comparisonWords from "../dictionaries/comparisonWords.js";
import educationTopics from "../dictionaries/educationTopics.js";
import storeTopics from "../dictionaries/storeTopics.js";

function containsWord(text, words) {
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

export default function classifyIntent(message) {
  const text = message.toLowerCase().trim();

  //
  // -------------------------------------------------
  // Recommendation
  // -------------------------------------------------
  //

  if (
    containsWord(text, recommendationWords) ||
    /\bbest\b/i.test(text) ||
    /\btop\b/i.test(text) ||
    /\bsuggest\b/i.test(text) ||
    /\brecommend\b/i.test(text) ||
    /\bgift\b/i.test(text) ||
    /\bfor my\b/i.test(text) ||
    /\bfor a\b/i.test(text)
  ) {
    return INTENTS.PRODUCT_RECOMMENDATION;
  }

  //
  // -------------------------------------------------
  // Comparison
  // -------------------------------------------------
  //

  const comparisonRequested =
    containsWord(text, comparisonWords) ||
    text.includes("which is better") ||
    text.includes("which one is better");

  const comparisonSeparators =
    text.includes(" vs ") ||
    text.includes(" versus ") ||
    text.includes(" and ");

  if (comparisonRequested && comparisonSeparators) {
    return INTENTS.PRODUCT_COMPARISON;
  }

  //
  // -------------------------------------------------
  // Education
  // -------------------------------------------------
  //

  if (
    containsWord(text, educationTopics) &&
    (text.includes("what is") ||
      text.includes("what are") ||
      text.includes("how") ||
      text.includes("why") ||
      text.includes("difference") ||
      text.includes("explain"))
  ) {
    return INTENTS.FRAGRANCE_EDUCATION;
  }

  //
  // -------------------------------------------------
  // Store
  // -------------------------------------------------
  //

  if (containsWord(text, storeTopics)) {
    return INTENTS.STORE_INFORMATION;
  }

  //
  // -------------------------------------------------
  // Greeting
  // -------------------------------------------------
  //

  if (text.length <= 25 && containsWord(text, greetings)) {
    return INTENTS.GREETING;
  }

  //
  // -------------------------------------------------
  // Product Search
  // -------------------------------------------------
  //

  return INTENTS.PRODUCT_SEARCH;
}
