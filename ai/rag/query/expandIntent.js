import { INTENTS } from "../../constants/intents.js";

import productTypes from "../../agent/dictionaries/productTypes.js";
import fragranceNotes from "../../agent/dictionaries/fragranceNotes.js";
import occasions from "../../agent/dictionaries/occasions.js";

import logger from "../../../utils/logger.js";

/**
 * Conversational filler words that should be stripped
 * from the user's query before sending it to WooCommerce.
 */
const FILLER_WORDS = [
  "recommend",
  "recommended",
  "suggest",
  "suggestion",
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
  "best",
  "good",
  "great",
  "nice",
  "help",
  "help me",
  "choose",
  "pick",
  "under",
  "below",
  "less than",
  "between",
  "and",
  "of",
  "to",
  "my",
  "for my",
  "for a",
  "for the",
];

/**
 * Intents that do not require product retrieval.
 */
const NON_PRODUCT_INTENTS = [
  INTENTS.GREETING,
  INTENTS.FRAGRANCE_EDUCATION,
  INTENTS.STORE_INFORMATION,
  INTENTS.UNKNOWN,
];

/**
 * Intents that should pass through without expansion
 * because they rely on conversation memory, not new searches.
 */
const PASS_THROUGH_INTENTS = [INTENTS.FOLLOW_UP];

/**
 * Strips conversational filler from a query string,
 * leaving only meaningful search terms.
 *
 * @param {string} query
 * @returns {string}
 */
function stripFiller(query) {
  if (!query) {
    return "";
  }

  let cleaned = query.toLowerCase();

  // Remove currency amounts (₦50,000, 50000, etc.)
  cleaned = cleaned.replace(/₦\s*[\d,]+/g, "");
  cleaned = cleaned.replace(/\bunder\s+[\d,]+\b/gi, "");
  cleaned = cleaned.replace(/\bbelow\s+[\d,]+\b/gi, "");
  cleaned = cleaned.replace(/\bless than\s+[\d,]+\b/gi, "");
  cleaned = cleaned.replace(/\bbetween\s+[\d,]+\s+and\s+[\d,]+\b/gi, "");

  // Remove filler words
  const words = cleaned
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER_WORDS.includes(word));

  return words.join(" ").trim();
}

/**
 * Gets the primary search alias for a product type.
 *
 * @param {string} productType
 * @returns {string|null}
 */
function getProductTypeSearchTerm(productType) {
  if (!productType) {
    return null;
  }

  const aliases = productTypes[productType];

  if (!aliases?.length) {
    return null;
  }

  return aliases[0];
}

/**
 * Gets the human-readable form of a fragrance note.
 *
 * @param {string} note
 * @returns {string|null}
 */
function getNoteSearchTerm(note) {
  if (!note) {
    return null;
  }

  const aliases = fragranceNotes[note];

  if (!aliases?.length) {
    return null;
  }

  return aliases[0];
}

/**
 * Gets the human-readable form of an occasion.
 *
 * @param {string} occasion
 * @returns {string|null}
 */
function getOccasionSearchTerm(occasion) {
  if (!occasion) {
    return null;
  }

  const aliases = occasions[occasion];

  if (!aliases?.length) {
    return null;
  }

  return aliases[0];
}

/**
 * Builds a clean keyword search term from the intent's
 * detected entities.
 *
 * Priority: brand > productType > note > occasion > stripped query
 *
 * @param {Object} intent
 * @returns {string}
 */
function buildKeywordSearchTerm(intent) {
  const parts = [];

  //
  // -------------------------
  // Brand
  // -------------------------
  //
  if (intent.brand?.name) {
    parts.push(intent.brand.name);
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //
  const productTypeTerm = getProductTypeSearchTerm(intent.productType);

  if (productTypeTerm) {
    parts.push(productTypeTerm);
  }

  //
  // -------------------------
  // Fragrance Note
  // -------------------------
  //
  const noteTerm = getNoteSearchTerm(intent.note);

  if (noteTerm) {
    parts.push(noteTerm);
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //
  const occasionTerm = getOccasionSearchTerm(intent.occasion);

  if (occasionTerm) {
    parts.push(occasionTerm);
  }

  //
  // -------------------------
  // Fallback: stripped query
  // -------------------------
  //
  if (!parts.length) {
    const stripped = stripFiller(intent.query);

    if (stripped) {
      parts.push(stripped);
    }
  }

  return parts.join(" ").trim();
}

/**
 * Builds the explicit search plan array.
 *
 * @param {Object} intent
 * @returns {Array}
 */
function buildSearches(intent) {
  const searches = [];

  //
  // -------------------------
  // Category Group
  // -------------------------
  //
  if (intent.categoryGroup?.slug) {
    searches.push({
      type: "category",
      value: intent.categoryGroup.slug,
    });
  }

  //
  // -------------------------
  // Brand
  // -------------------------
  //
  if (intent.brand?.name) {
    searches.push({
      type: "brand",
      value: intent.brand.name,
    });
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //
  if (intent.productType) {
    const term = getProductTypeSearchTerm(intent.productType);

    if (term) {
      searches.push({
        type: "productType",
        value: intent.productType,
        searchTerm: term,
      });
    }
  }

  //
  // -------------------------
  // Keyword
  // -------------------------
  //
  const keywordTerm = buildKeywordSearchTerm(intent);

  if (keywordTerm) {
    searches.push({
      type: "keyword",
      value: keywordTerm,
    });
  }

  //
  // -------------------------
  // Featured
  // -------------------------
  //
  if (intent.featured) {
    searches.push({
      type: "featured",
      value: true,
    });
  }

  return searches;
}

/**
 * Intent Expansion Layer
 *
 * Transforms the raw conversational query into clean,
 * targeted search terms before product retrieval.
 *
 * This function sits between intent detection / memory resolution
 * and the retrieval strategies. It does NOT change the intent type.
 * It only refines the query and builds an explicit search plan.
 *
 * @param {Object} intent - The detected + memory-resolved intent
 * @returns {Object} Expanded intent with clean query + searches array
 */
export default function expandIntent(intent = {}) {
  //
  // -------------------------
  // Guard: no intent
  // -------------------------
  //
  if (!intent || !intent.type) {
    return intent;
  }

  //
  // -------------------------
  // Pass-through intents
  // (follow-up relies on memory, not new searches)
  // -------------------------
  //
  if (PASS_THROUGH_INTENTS.includes(intent.type)) {
    logger.info({
      message: "expandIntent: pass-through (follow-up).",
      intent: intent.type,
    });

    return {
      ...intent,
      expandedQuery: intent.query,
      searches: [],
    };
  }

  //
  // -------------------------
  // Non-product intents
  // (greeting, education, store info)
  // -------------------------
  //
  if (NON_PRODUCT_INTENTS.includes(intent.type)) {
    logger.info({
      message: "expandIntent: non-product intent, no searches.",
      intent: intent.type,
    });

    return {
      ...intent,
      expandedQuery: stripFiller(intent.query),
      searches: [],
    };
  }

  //
  // -------------------------
  // Product intents — expand
  // -------------------------
  //
  const expandedQuery = buildKeywordSearchTerm(intent);

  const searches = buildSearches(intent);

  logger.info({
    message: "expandIntent: query expanded.",
    intent: intent.type,
    originalQuery: intent.query,
    expandedQuery,
    searchCount: searches.length,
  });

  return {
    ...intent,
    expandedQuery,
    searches,
  };
}
