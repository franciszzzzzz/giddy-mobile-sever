import SAFETY_MESSAGES from "./safetyMessages.js";

/**
 * Keywords that strongly indicate the request
 * is related to Giddy & Claire.
 */
const ALLOWED_KEYWORDS = [
  // Perfume
  "perfume",
  "perfumes",
  "fragrance",
  "fragrances",
  "cologne",
  "scent",
  "smell",
  "aroma",
  "body spray",
  "perfume oil",

  // Recommendations
  "recommend",
  "recommendation",
  "suggest",
  "looking for",
  "need a perfume",
  "best perfume",
  "gift",

  // Fragrance Topics
  "notes",
  "top notes",
  "middle notes",
  "base notes",
  "longevity",
  "projection",
  "sillage",
  "layering",
  "occasion",
  "office",
  "date",
  "wedding",
  "party",

  // Shopping
  "price",
  "budget",
  "buy",
  "purchase",
  "order",
  "shipping",
  "delivery",
  "return",
  "refund",
  "payment",
  "checkout",

  // Product Catalog
  "brand",
  "lattafa",
  "armaf",
  "afnan",
  "maison alhambra",
  "club de nuit",
  "khamrah",
];

/**
 * Topics Claire should never answer.
 */
const BLOCKED_KEYWORDS = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "react",
  "react native",
  "node",
  "express",
  "sql",
  "mongodb",
  "html",
  "css",

  "hack",
  "hacking",
  "malware",
  "virus",
  "exploit",
  "phishing",
  "ddos",
  "sql injection",

  "politics",
  "election",
  "president",

  "religion",
  "bible",
  "quran",

  "medical",
  "diagnosis",
  "medicine",

  "investment",
  "crypto",
  "bitcoin",
  "stocks",

  "porn",
  "sex",

  "homework",
  "assignment",
  "exam",

  "recipe",
  "football",
  "movie",
  "music",
  "weather",
];

/**
 * Checks whether a message contains
 * one of the supplied keywords.
 */
function containsKeyword(message, keywords) {
  return keywords.some((keyword) => message.includes(keyword));
}

/**
 * Determines whether Claire should
 * answer the user's request.
 *
 * Returns:
 *
 * ALLOW
 * BLOCK
 * UNCERTAIN
 */
export function checkAllowedTopic(message) {
  if (!message || typeof message !== "string") {
    return {
      allowed: false,
      reason: "EMPTY_INPUT",
      ...SAFETY_MESSAGES.EMPTY_INPUT,
    };
  }

  const normalized = message.toLowerCase().trim();

  if (containsKeyword(normalized, BLOCKED_KEYWORDS)) {
    return {
      allowed: false,
      reason: "BLOCKED_TOPIC",
      ...SAFETY_MESSAGES.OFF_TOPIC,
    };
  }

  if (containsKeyword(normalized, ALLOWED_KEYWORDS)) {
    return {
      allowed: true,
      uncertain: false,
    };
  }

  return {
    allowed: true,
    uncertain: true,
  };
}

export default {
  checkAllowedTopic,
};
