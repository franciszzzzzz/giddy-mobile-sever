import { INTENTS } from "../../constants/intents.js";

import greetings from "../dictionaries/greetings.js";
import recommendationWords from "../dictionaries/recommendationWords.js";
import comparisonWords from "../dictionaries/comparisonWords.js";
import educationTopics from "../dictionaries/educationTopics.js";
import storeTopics from "../dictionaries/storeTopics.js";

import fuzzyMatch from "./fuzzyDictionaryMatcher.js";

export default function classifyIntent(message) {
  const text = message.toLowerCase().trim();

  //
  // Greeting
  //
  if (fuzzyMatch(greetings, text) || /\b(hi|hey|hello)\b/.test(text)) {
    return INTENTS.GREETING;
  }

  //
  // Recommendation
  //
  if (fuzzyMatch(recommendationWords, text) || /\bbest\b/.test(text)) {
    return INTENTS.PRODUCT_RECOMMENDATION;
  }

  //
  // Comparison
  //
  const comparisonRequested =
    fuzzyMatch(comparisonWords, text) ||
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
  // Shopping
  //
  const shoppingWords = [
    "show",
    "find",
    "search",
    "looking for",
    "browse",
    "buy",
    "need",
    "have",
    "similar",
  ];

  if (fuzzyMatch(shoppingWords, text)) {
    return INTENTS.PRODUCT_SEARCH;
  }

  //
  // Education
  //
  if (
    fuzzyMatch(educationTopics, text) &&
    (text.includes("what") ||
      text.includes("how") ||
      text.includes("why") ||
      text.includes("difference") ||
      text.includes("explain"))
  ) {
    return INTENTS.FRAGRANCE_EDUCATION;
  }

  //
  // Store info
  //
  if (fuzzyMatch(storeTopics, text)) {
    return INTENTS.STORE_INFORMATION;
  }

  return INTENTS.PRODUCT_SEARCH;
}
