import { INTENTS } from "../../constants/intents.js";

import greetings from "../dictionaries/greetings.js";
import recommendationWords from "../dictionaries/recommendationWords.js";
import comparisonWords from "../dictionaries/comparisonWords.js";
import educationTopics from "../dictionaries/educationTopics.js";
import storeTopics from "../dictionaries/storeTopics.js";

export default function classifyIntent(message) {
  const text = message.toLowerCase().trim();
  const words = text.match(/\b[\w']+\b/g) || [];
  //
  // Greeting
  //
  const firstWord = words[0] ?? "";

  const isGreeting =
    greetings.includes(firstWord) ||
    greetings.some((greeting) => text.startsWith(`${greeting} `)) ||
    greetings.includes(text);

  if (isGreeting) {
    return INTENTS.GREETING;
  }
  //
  // Recommendation
  //
  if (
    recommendationWords.some((word) => text.includes(word)) ||
    /\bbest\b/.test(text)
  ) {
    return INTENTS.PRODUCT_RECOMMENDATION;
  }

  //
  // Comparison
  //
  const comparisonRequested =
    comparisonWords.some((word) => text.includes(word)) ||
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
  // Shopping/Search
  //
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
    "similar",
  ];

  if (shoppingWords.some((word) => text.includes(word))) {
    return INTENTS.PRODUCT_SEARCH;
  }

  //
  // Education
  //
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

  //
  // Store Information
  //
  if (storeTopics.some((word) => text.includes(word))) {
    return INTENTS.STORE_INFORMATION;
  }

  return INTENTS.PRODUCT_SEARCH;
}
