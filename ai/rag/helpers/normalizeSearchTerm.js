/**
 * Normalizes a customer's query into a search phrase
 * that can be safely sent to WooCommerce.
 *
 * Removes filler words while preserving
 * meaningful perfume keywords.
 */

const STOP_WORDS = [
  "show",
  "find",
  "search",
  "looking",
  "look",
  "for",
  "i",
  "want",
  "need",
  "buy",
  "have",
  "recommend",
  "recommended",
  "suggest",
  "please",
  "give",
  "me",
  "can",
  "could",
  "would",
  "like",
  "something",
  "that",
  "with",
  "about",
  "tell",
  "what",
  "is",
  "the",
  "a",
  "an",
];

export default function normalizeSearchTerm(query = "") {
  if (!query) {
    return "";
  }

  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.includes(word))
    .join(" ")
    .trim();
}
