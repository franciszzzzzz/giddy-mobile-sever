import { INTENTS } from "../../constants/intents.js";

import productTypes from "../../agent/dictionaries/productTypes.js";
import fragranceNotes from "../../agent/dictionaries/fragranceNotes.js";
import occasions from "../../agent/dictionaries/occasions.js";
import categoryGroups from "../../agent/dictionaries/categoryGroups.js";
import genders from "../../agent/dictionaries/genders.js";

import { isBrandMentioned } from "../../agent/intentDetector/brandDetector.js";

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
  "your",
  "her",
  "him",
  "yeah",
  "option",
  "options",
  "product",
  "products",
  "recommendation",
  "recommendations",
  "seller",
  "sellers",
  "stuff",
  "things",
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
 * Negation words. When one of these precedes a term, that term is something
 * the user does NOT want, so it must be dropped from the keyword search and
 * must not trigger a brand/productType retrieval search.
 *
 * Example: "no i don't want nashein something more elegant" -> the
 * memory-inherited brand "Nashein" is rejected by the user and must be
 * excluded; without this, the old code searched for "Nashein" and returned
 * the exact products the user just refused.
 */
const NEGATION_WORDS = new Set([
  "no",
  "not",
  "dont",
  "dontt",
  "without",
  "exclude",
  "except",
  "rather",
  "instead",
]);

/**
 * Common English contractions expanded to their full forms so the negation
 * check (and filler stripping) sees the real word. The apostrophe would
 * otherwise be turned into a space by stripFiller's punctuation filter,
 * producing fragments like "don" that survive into the search term.
 */
function expandContractions(text) {
  if (!text) return "";

  return text
    .toLowerCase()
    .replace(/\bdon['’]t\b/g, "do not")
    .replace(/\bdoesn['’]t\b/g, "does not")
    .replace(/\bisn['’]t\b/g, "is not")
    .replace(/\baren['’]t\b/g, "are not")
    .replace(/\bwasn['’]t\b/g, "was not")
    .replace(/\bweren['’]t\b/g, "were not")
    .replace(/\bwon['’]t\b/g, "will not")
    .replace(/\bcan['’]t\b/g, "can not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/\bcouldn['’]t\b/g, "could not")
    .replace(/\bshouldn['’]t\b/g, "should not")
    .replace(/\bwouldn['’]t\b/g, "would not")
    .replace(/\bno['’]/g, "no");
}

/**
 * Returns the set of query tokens that are negated (preceded by a negation
 * word) plus any multi-word entity names that contain a negated token.
 *
 * Used to suppress negated terms from the keyword search and to neutralize
 * a memory-inherited brand the user has explicitly rejected.
 *
 * @param {string} query - Original user query
 * @returns {Set<string>} lower-cased negated tokens
 */
function getNegatedTokens(query) {
  if (!query) return new Set();

  const expanded = expandContractions(query);

  // Drop punctuation, then tokenize.
  const tokens = expanded
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const negated = new Set();

  for (let i = 0; i < tokens.length; i++) {
    if (NEGATION_WORDS.has(tokens[i]) && i + 1 < tokens.length) {
      // Mark the immediately following token (the rejected thing).
      negated.add(tokens[i + 1]);
    }
  }

  return negated;
}

/**
 * Checks whether a term (brand name, product type alias, etc.) has been
 * negated by the user in the current query.
 *
 * @param {Set<string>} negatedTokens
 * @param {string} term
 * @returns {boolean}
 */
function isNegated(negatedTokens, term) {
  if (!term || negatedTokens.size === 0) return false;

  const termLower = term.toLowerCase();

  // Direct hit on the term, or any word of a multi-word term.
  if (negatedTokens.has(termLower)) return true;

  return termLower
    .split(/\s+/)
    .some((word) => word.length > 2 && negatedTokens.has(word));
}

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

  // Expand contractions FIRST so "don't" -> "do not" before the apostrophe
  // is stripped. Otherwise the apostrophe becomes a space and produces
  // fragments like "don" that leak into the keyword search.
  let cleaned = expandContractions(query);

  // Remove currency amounts (₦50,000, 50000, etc.)
  cleaned = cleaned.replace(/₦\s*[\d,]+/g, "");
  cleaned = cleaned.replace(/\bunder\s+[\d,]+\b/gi, "");
  cleaned = cleaned.replace(/\bbelow\s+[\d,]+\b/gi, "");
  cleaned = cleaned.replace(/\bless than\s+[\d,]+\b/gi, "");
  cleaned = cleaned.replace(/\bbetween\s+[\d,]+\s+and\s+[\d,]+\b/gi, "");

  // Remove filler words + bare negation words ("no", "not", "without", ...).
  const words = cleaned
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        !FILLER_WORDS.has(word) &&
        !NEGATION_WORDS.has(word),
    );

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
 * Delegates to brandDetector.isBrandMentioned() so detection and the mention
 * check share the exact same guards (stop words, window length, score gate,
 * length-ratio, prefix exception). A brand detected upstream with a typo
 * ("Sahib" -> "Sahiib") survives; an unrelated memory-inherited brand or a
 * filler word ("seller" -> "Stellar") is rejected.
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

  return isBrandMentioned(query, brand);
}

/**
 * Checks whether any alias appears in the query as a WHOLE WORD.
 *
 * The previous raw-substring test let short aliases hide inside unrelated
 * words: the gender alias "her" matched inside "otHER", silently injecting a
 * gender term into queries like "other products". Word-boundary matching
 * matches the same style the entity extractor already uses (contains()).
 *
 * @param {string} query
 * @param {string[]} aliases
 * @returns {boolean}
 */
function containsAlias(query, aliases) {
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(`\\b${escaped}\\b`, "i").test(query);
  });
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

  return containsAlias(query, aliases);
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

  return containsAlias(query, aliases);
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

  return containsAlias(query, aliases);
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

  return containsAlias(query, aliases);
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

  return containsAlias(query, aliases);
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

  // Compute negated tokens once so we can drop anything the user rejected
  // (e.g. "no i don't want nashein" -> "nashein" is negated).
  const negatedTokens = getNegatedTokens(query);

  //
  // -------------------------
  // Brand — only if mentioned in current query AND not negated
  // -------------------------
  //
  if (
    intent.brand?.name &&
    isBrandMentionedInQuery(query, intent.brand) &&
    !isNegated(negatedTokens, intent.brand.name)
  ) {
    parts.push(intent.brand.name);
  }

  //
  // -------------------------
  // Product Type — only if mentioned in current query
  // -------------------------
  //
  if (
    intent.productType &&
    isProductTypeMentioned(query, intent.productType) &&
    !isNegated(negatedTokens, getProductTypeSearchTerm(intent.productType))
  ) {
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
  if (
    intent.note &&
    isNoteMentioned(query, intent.note) &&
    !isNegated(negatedTokens, getNoteSearchTerm(intent.note))
  ) {
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
  if (
    intent.occasion &&
    isOccasionMentioned(query, intent.occasion) &&
    !isNegated(negatedTokens, getOccasionSearchTerm(intent.occasion))
  ) {
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
  if (
    intent.gender &&
    isGenderMentioned(query, intent.gender) &&
    !isNegated(negatedTokens, getGenderSearchTerm(intent.gender))
  ) {
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
    isCategoryGroupMentioned(query, intent.categoryGroup.slug) &&
    !isNegated(
      negatedTokens,
      getCategoryGroupSearchTerm(intent.categoryGroup.slug),
    )
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

    // Add words from the stripped query that aren't already included,
    // aren't single common words like "good"/"nice", AND aren't negated.
    for (const word of strippedWords) {
      const wordLower = word.toLowerCase();

      if (
        !alreadyIncluded.has(wordLower) &&
        wordLower.length > 2 &&
        !negatedTokens.has(wordLower)
      ) {
        parts.push(word);
      }
    }
  }

  // Distinct entity terms can collide ("for her" yields both a gender term
  // and a category-group term "women"); dedupe while preserving order.
  return [...new Set(parts)].join(" ").trim();
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

  // Tokens the user explicitly rejected ("no i don't want nashein") must not
  // drive a dedicated retrieval search, so a negated brand/productType/
  // categoryGroup is dropped here just like in buildKeywordSearchTerm().
  const negatedTokens = getNegatedTokens(query);

  const result = {
    brand: undefined,
    productType: undefined,
    categoryGroup: undefined,
  };

  //
  // -------------------------
  // Brand — only if its name appears in the current query AND isn't negated
  // -------------------------
  //
  if (
    intent.brand?.name &&
    isBrandMentionedInQuery(query, intent.brand) &&
    !isNegated(negatedTokens, intent.brand.name)
  ) {
    result.brand = intent.brand;
  }

  //
  // -------------------------
  // Product Type — only if any alias is mentioned in the current query
  // AND isn't negated
  // -------------------------
  //
  if (
    intent.productType &&
    isProductTypeMentioned(query, intent.productType) &&
    !isNegated(negatedTokens, getProductTypeSearchTerm(intent.productType))
  ) {
    result.productType = intent.productType;
  }

  //
  // -------------------------
  // Category Group — only if any alias is mentioned in the current query
  // AND isn't negated
  // -------------------------
  //
  if (
    intent.categoryGroup?.slug &&
    isCategoryGroupMentioned(query, intent.categoryGroup.slug) &&
    !isNegated(
      negatedTokens,
      getCategoryGroupSearchTerm(intent.categoryGroup.slug),
    )
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

    // Non-product intents (greeting, education, store info) must NEVER trigger
    // product retrieval. Strip the retrieval-driving entities that may have been
    // inherited from conversation memory, otherwise a leftover brand/productType/
    // categoryGroup would satisfy a retrieval strategy's condition and fire an
    // unrelated search (e.g. a GREETING still pulling productsByBrand:Nashein
    // from a prior turn). `searches: []` already prevents the keyword search,
    // but the strategy conditions read intent.brand / intent.productType /
    // intent.categoryGroup directly, so those must be cleared too.
    return {
      ...intent,
      brand: undefined,
      productType: undefined,
      categoryGroup: undefined,
      note: undefined,
      occasion: undefined,
      gender: undefined,
      featured: false,
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
