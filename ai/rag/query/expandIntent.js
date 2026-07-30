import Fuse from "fuse.js";

import { INTENTS } from "../../constants/intents.js";

import productTypes from "../../agent/dictionaries/productTypes.js";
import fragranceNotes from "../../agent/dictionaries/fragranceNotes.js";
import occasions from "../../agent/dictionaries/occasions.js";
import categoryGroups from "../../agent/dictionaries/categoryGroups.js";
import genders from "../../agent/dictionaries/genders.js";

import logger from "../../../utils/logger.js";

/**
 * Conversational filler words that should be stripped
 * from the user's query before sending it to WooCommerce.
 *
 * Includes common misspellings.
 */
const FILLER_WORDS = new Set([
  "recommend",
  "recomend",
  "recommed",
  "recommended",
  "recomended",
  "suggest",
  "sugest",
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
  "choose",
  "pick",
  "under",
  "below",
  "less",
  "than",
  "between",
  "and",
  "of",
  "to",
  "my",
  "another",
  "other",
  "else",
  "more",
  "some",
  "any",
  "which",
  "who",
  "how",
  "why",
  "when",
  "where",
]);

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
 * Score gate and max window size for fuzzy brand-mention checks.
 *
 * Kept in sync with the detection layer in entityExtractor.js so a brand
 * detected upstream ("Sahib" -> "Sahiib") is not stripped here by a strict
 * literal substring test.
 */
const BRAND_MATCH_THRESHOLD = 0.4;
const MAX_BRAND_WORDS = 3;

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
    .filter((word) => word && !FILLER_WORDS.has(word));

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
 * Gets the human-readable form of a gender.
 *
 * @param {string} gender
 * @returns {string|null}
 */
function getGenderSearchTerm(gender) {
  if (!gender) {
    return null;
  }

  const aliases = genders[gender];

  if (!aliases?.length) {
    return null;
  }

  return aliases[0];
}

/**
 * Gets the human-readable form of a category group.
 *
 * @param {string} slug
 * @returns {string|null}
 */
function getCategoryGroupSearchTerm(slug) {
  if (!slug) {
    return null;
  }

  const aliases = categoryGroups[slug];

  if (!aliases?.length) {
    return null;
  }

  return aliases[0];
}

/**
 * Checks whether a term appears in the original query text.
 *
 * This prevents memory-inherited entities from polluting
 * the keyword search when the user didn't actually mention
 * them in the current message.
 *
 * @param {string} query - The original user query
 * @param {string} term - The term to check for
 * @returns {boolean}
 */
function isMentionedInQuery(query, term) {
  if (!query || !term) {
    return false;
  }

  const queryLower = query.toLowerCase();
  const termLower = term.toLowerCase();

  if (queryLower.includes(termLower)) {
    return true;
  }

  const words = termLower.split(/\s+/);
  if (words.length > 1) {
    return words.some((word) => word.length > 2 && queryLower.includes(word));
  }

  return false;
}

/**
 * Checks whether a brand was mentioned in the current query.
 *
 * The generic isMentionedInQuery() uses a literal substring test, which drops
 * any fuzzy-detected brand whose stored name differs from the typed token —
 * e.g. a query "Sahib" against detected brand "Sahiib". Because brand detection
 * is intentionally typo-tolerant, the mention check must be too; otherwise the
 * detected brand is neutralized before retrieval and only an ineffective keyword
 * search fires.
 *
 * Accepts the mention when either:
 *  - the literal substring (or multi-word fallback) matches, OR
 *  - any query token / window fuzzy-matches the brand name within the score gate.
 *
 * Memory-inherited brands the user did NOT mention still fail both checks and
 * are correctly stripped, preserving the regression-protection behavior.
 *
 * @param {string} query - The original user query
 * @param {Object} brand - { name, slug? }
 * @returns {boolean}
 */
function isBrandMentionedInQuery(query, brand) {
  if (!query || !brand?.name) {
    return false;
  }

  if (isMentionedInQuery(query, brand.name)) {
    return true;
  }

  const queryLower = query.toLowerCase();

  const tokens = queryLower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const fuse = new Fuse(
    [{ name: brand.name.toLowerCase(), slug: (brand.slug || "").toLowerCase() }],
    {
      keys: ["name", "slug"],
      threshold: BRAND_MATCH_THRESHOLD,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
    },
  );

  for (let size = 1; size <= MAX_BRAND_WORDS; size++) {
    for (let start = 0; start + size <= tokens.length; start++) {
      const phrase = tokens.slice(start, start + size).join(" ");

      const result = fuse.search(phrase);

      if (result.length && result[0].score <= BRAND_MATCH_THRESHOLD) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a product type was mentioned in the query
 * by looking at all its aliases.
 *
 * @param {string} query
 * @param {string} productType
 * @returns {boolean}
 */
function isProductTypeMentioned(query, productType) {
  if (!query || !productType) {
    return false;
  }

  const aliases = productTypes[productType];

  if (!aliases?.length) {
    return false;
  }

  return aliases.some((alias) =>
    query.toLowerCase().includes(alias.toLowerCase()),
  );
}

/**
 * Checks whether a fragrance note was mentioned in the query
 * by looking at all its aliases.
 *
 * @param {string} query
 * @param {string} note
 * @returns {boolean}
 */
function isNoteMentioned(query, note) {
  if (!query || !note) {
    return false;
  }

  const aliases = fragranceNotes[note];

  if (!aliases?.length) {
    return false;
  }

  return aliases.some((alias) =>
    query.toLowerCase().includes(alias.toLowerCase()),
  );
}

/**
 * Checks whether an occasion was mentioned in the query
 * by looking at all its aliases.
 *
 * @param {string} query
 * @param {string} occasion
 * @returns {boolean}
 */
function isOccasionMentioned(query, occasion) {
  if (!query || !occasion) {
    return false;
  }

  const aliases = occasions[occasion];

  if (!aliases?.length) {
    return false;
  }

  return aliases.some((alias) =>
    query.toLowerCase().includes(alias.toLowerCase()),
  );
}

/**
 * Checks whether a gender was mentioned in the query
 * by looking at all its aliases.
 *
 * @param {string} query
 * @param {string} gender
 * @returns {boolean}
 */
function isGenderMentioned(query, gender) {
  if (!query || !gender) {
    return false;
  }

  const aliases = genders[gender];

  if (!aliases?.length) {
    return false;
  }

  return aliases.some((alias) =>
    query.toLowerCase().includes(alias.toLowerCase()),
  );
}

/**
 * Checks whether a category group was mentioned in the query
 * by looking at all its aliases.
 *
 * @param {string} query
 * @param {string} slug
 * @returns {boolean}
 */
function isCategoryGroupMentioned(query, slug) {
  if (!query || !slug) {
    return false;
  }

  const aliases = categoryGroups[slug];

  if (!aliases?.length) {
    return false;
  }

  return aliases.some((alias) =>
    query.toLowerCase().includes(alias.toLowerCase()),
  );
}

/**
 * Builds a clean keyword search term from the intent's
 * detected entities.
 *
 * IMPORTANT: Only includes entities that were actually mentioned
 * in the current query, NOT entities inherited from conversation memory.
 * This prevents stale brand/productType from polluting unrelated queries.
 *
 * Priority: brand > productType > note > occasion > gender > categoryGroup > stripped query
 *
 * @param {Object} intent
 * @returns {string}
 */
function buildKeywordSearchTerm(intent) {
  const parts = [];
  const query = intent.query || "";

  //
  // -------------------------
  // Brand — only if mentioned in current query
  // -------------------------
  //
  if (intent.brand?.name && isBrandMentionedInQuery(query, intent.brand)) {
    parts.push(intent.brand.name);
  }

  //
  // -------------------------
  // Product Type — only if mentioned in current query
  // -------------------------
  //
  if (intent.productType && isProductTypeMentioned(query, intent.productType)) {
    const productTypeTerm = getProductTypeSearchTerm(intent.productType);

    if (productTypeTerm) {
      parts.push(productTypeTerm);
    }
  }

  //
  // -------------------------
  // Fragrance Note — only if mentioned in current query
  // -------------------------
  //
  if (intent.note && isNoteMentioned(query, intent.note)) {
    const noteTerm = getNoteSearchTerm(intent.note);

    if (noteTerm) {
      parts.push(noteTerm);
    }
  }

  //
  // -------------------------
  // Occasion — only if mentioned in current query
  // -------------------------
  //
  if (intent.occasion && isOccasionMentioned(query, intent.occasion)) {
    const occasionTerm = getOccasionSearchTerm(intent.occasion);

    if (occasionTerm) {
      parts.push(occasionTerm);
    }
  }

  //
  // -------------------------
  // Gender — only if mentioned in current query
  // -------------------------
  //
  if (intent.gender && isGenderMentioned(query, intent.gender)) {
    const genderTerm = getGenderSearchTerm(intent.gender);

    if (genderTerm) {
      parts.push(genderTerm);
    }
  }

  //
  // -------------------------
  // Category Group — only if mentioned in current query
  // -------------------------
  //
  if (
    intent.categoryGroup?.slug &&
    isCategoryGroupMentioned(query, intent.categoryGroup.slug)
  ) {
    const categoryTerm = getCategoryGroupSearchTerm(intent.categoryGroup.slug);

    if (categoryTerm) {
      parts.push(categoryTerm);
    }
  }

  //
  // -------------------------
  // Remaining meaningful words from stripped query
  // -------------------------
  //
  // Even when we have entity-based terms, the user may have
  // mentioned specific brand names or product names that weren't
  // detected as entities. We need to include those too.
  //
  const stripped = stripFiller(query);

  if (stripped) {
    const strippedWords = stripped.split(/\s+/);

    // Get all the alias words we've already included
    const alreadyIncluded = new Set(parts.join(" ").toLowerCase().split(/\s+/));

    // Add words from the stripped query that aren't already included
    // and aren't single common words like "good", "nice" etc.
    for (const word of strippedWords) {
      const wordLower = word.toLowerCase();

      if (!alreadyIncluded.has(wordLower) && wordLower.length > 2) {
        parts.push(word);
      }
    }
  }

  return parts.join(" ").trim();
}

/**
 * Returns an entity value only if it was actually mentioned in the
 * current query. Memory-inherited entities that the user did NOT
 * mention are dropped so they don't trigger unrelated retrieval searches.
 *
 * `intent.brand`, `intent.productType` and `intent.categoryGroup` drive
 * dedicated retrieval strategies (brand / productType / category), so a
 * stale value here pollutes the results even when the keyword search is
 * clean. This is the companion to the keyword isolation in
 * buildKeywordSearchTerm().
 *
 * @param {Object} intent
 * @returns {Object} Cleaned entities { brand, productType, categoryGroup }
 */
function getCurrentQueryEntities(intent) {
  const query = intent.query || "";

  const result = {
    brand: undefined,
    productType: undefined,
    categoryGroup: undefined,
  };

  //
  // -------------------------
  // Brand — only if its name appears in the current query
  // -------------------------
  //
  if (intent.brand?.name && isBrandMentionedInQuery(query, intent.brand)) {
    result.brand = intent.brand;
  }

  //
  // -------------------------
  // Product Type — only if any alias is mentioned in the current query
  // -------------------------
  //
  if (intent.productType && isProductTypeMentioned(query, intent.productType)) {
    result.productType = intent.productType;
  }

  //
  // -------------------------
  // Category Group — only if any alias is mentioned in the current query
  // -------------------------
  //
  if (
    intent.categoryGroup?.slug &&
    isCategoryGroupMentioned(query, intent.categoryGroup.slug)
  ) {
    result.categoryGroup = intent.categoryGroup;
  }

  return result;
}

/**
 * Builds the explicit search plan array.
 *
 * Includes all searches (even memory-inherited ones) because
 * the retrieval strategies need the full intent context.
 * The keyword search, however, only uses current-query terms.
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
 * Key behavior:
 * - The expandedQuery (used for keyword search) only includes
 *   entities mentioned in the CURRENT query, not memory-inherited ones.
 * - Retrieval-driving entities (brand, productType, categoryGroup) on the
 *   returned object are also limited to those mentioned in the CURRENT
 *   query, so memory-inherited values don't trigger unrelated searches.
 *   The original memory-resolved entities stay on `intent` for callers
 *   (e.g. the prompt builder) that need full conversation context.
 * - The searches array includes all entities (current + memory)
 *   so retrieval strategies can still use memory context.
 * - Follow-up intents pass through without expansion.
 * - Non-product intents (greeting, education, store info) skip searches.
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
  // Limit retrieval-driving entities to those mentioned in the CURRENT
  // query. Memory-inherited brand / productType / categoryGroup would
  // otherwise fire dedicated retrieval searches (e.g. productsByBrand)
  // that have nothing to do with what the user just asked for.
  //
  const { brand, productType, categoryGroup } =
    getCurrentQueryEntities(intent);

  const cleanedIntent = {
    ...intent,
    brand,
    productType,
    categoryGroup,
  };

  const expandedQuery = buildKeywordSearchTerm(cleanedIntent);

  const searches = buildSearches(cleanedIntent);

  logger.info({
    message: "expandIntent: query expanded.",
    intent: intent.type,
    originalQuery: intent.query,
    expandedQuery,
    searchCount: searches.length,
  });

  return {
    ...cleanedIntent,
    expandedQuery,
    searches,
  };
}
