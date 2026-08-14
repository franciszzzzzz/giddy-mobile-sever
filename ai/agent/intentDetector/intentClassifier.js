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

export default function classifyIntent(message, entities = {}) {
  const text = message.toLowerCase().trim();

  //
  // -----------------------------------------
  // Greeting
  // -----------------------------------------
  //

  if (text.length <= 25 && containsWord(text, greetings)) {
    return INTENTS.GREETING;
  }

  //
  // -----------------------------------------
  // Follow-up
  // -----------------------------------------
  //

  if (
    /^(it|this|that|they|them)\b/i.test(text) ||
    /\b(first|second|third|fourth|last)\b/i.test(text) ||
    /\bwhat about\b/i.test(text) ||
    /\bhow about\b/i.test(text) ||
    /\bdoes it\b/i.test(text) ||
    /\bis it\b/i.test(text) ||
    /\bdoes this\b/i.test(text) ||
    /\bthat one\b/i.test(text) ||
    // The chat UI's own suggestion chips send these. Without this they fell
    // through to a keyword search for "options"/"products" that returns
    // nothing; as follow-ups they reuse the products from the last turn.
    /\b(show more|more options|other products|anything else|something else|another one)\b/i.test(
      text,
    )
  ) {
    return INTENTS.FOLLOW_UP;
  }

  //
  // -----------------------------------------
  // Comparison
  // -----------------------------------------
  //

  const comparisonRequested =
    containsWord(text, comparisonWords) ||
    text.includes(" vs ") ||
    text.includes(" versus ") ||
    text.includes("compare");

  if (comparisonRequested) {
    return INTENTS.PRODUCT_COMPARISON;
  }

  //
  // -----------------------------------------
  // Education
  // -----------------------------------------
  //

  if (
    containsWord(text, educationTopics) &&
    (text.includes("what is") ||
      text.includes("what are") ||
      text.includes("why") ||
      text.includes("difference") ||
      text.includes("how"))
  ) {
    return INTENTS.FRAGRANCE_EDUCATION;
  }

  //
  // -----------------------------------------
  // Store Information
  // -----------------------------------------
  //

  if (containsWord(text, storeTopics)) {
    return INTENTS.STORE_INFORMATION;
  }

  //
  // -----------------------------------------
  // Recommendation
  // -----------------------------------------
  //

  if (
    containsWord(text, recommendationWords) ||
    /\brecommend\b/i.test(text) ||
    /\bsuggest\b/i.test(text) ||
    /\bbest\b/i.test(text) ||
    /\bgift\b/i.test(text) ||
    /\bfor my\b/i.test(text) ||
    /\bfor a\b/i.test(text)
  ) {
    return INTENTS.PRODUCT_RECOMMENDATION;
  }

  //
  // -----------------------------------------
  // Product Information
  // -----------------------------------------
  //

  if (
    entities.brand ||
    entities.product ||
    text.startsWith("tell me about") ||
    text.startsWith("what does") ||
    text.startsWith("how does") ||
    text.startsWith("is ") ||
    text.startsWith("does ")
  ) {
    return INTENTS.PRODUCT_INFORMATION;
  }

  //
  // -----------------------------------------
  // Product Search
  // -----------------------------------------
  //

  return INTENTS.PRODUCT_SEARCH;
}
