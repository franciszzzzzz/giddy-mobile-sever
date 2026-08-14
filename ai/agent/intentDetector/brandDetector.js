import Fuse from "fuse.js";

import genders from "../dictionaries/genders.js";

/**
 * Max number of words a single brand name can span.
 *
 * Brand names like "Oudh Al Mubaarak" are three words, so the
 * sliding window needs to consider up to three consecutive tokens.
 */
const MAX_BRAND_WORDS = 3;

/**
 * Score below which a Fuse brand match is accepted.
 *
 * 0.4 tolerates common typos ("Sahib" -> "Sahiib") and minor
 * spelling drift while rejecting unrelated short tokens.
 */
const BRAND_MATCH_THRESHOLD = 0.4;

/**
 * Generic product-category words that must NEVER be treated as brand names.
 *
 * Some catalogs contain brands whose names include these words (e.g. a brand
 * literally called "Perfume" or a slug like "perfume-co"), and the fuzzy
 * matcher will happily accept "perfume" as a brand with a low score. That
 * causes queries like "recommend a perfume" to fire a productsByBrand search
 * for the non-brand "Perfume", polluting results. These words describe the
 * product TYPE, not a brand, so any brand match whose matched phrase is one
 * of these is rejected.
 */
const GENERIC_NON_BRAND_WORDS = new Set([
  "perfume",
  "perfumes",
  "cologne",
  "colognes",
  "fragrance",
  "fragrances",
  "scent",
  "scents",
  "deodorant",
  "deodorants",
  "lotion",
  "lotions",
  "cream",
  "creams",
  "soap",
  "soaps",
  "oil",
  "oils",
  "spray",
  "sprays",
  "diffuser",
  "diffusers",
  "candle",
  "candles",
  "gift",
  "gifts",
  "set",
  "sets",
  "body",
  "bath",
  "shower",
  "hair",
  "skin",
  "makeup",
  "lipstick",
  "mist",
  "mists",
]);

/**
 * Gender words that must NEVER be treated as brand names.
 *
 * Catalogs commonly carry a tag literally called "Men" or "Women" (a gender
 * facet leak), and gender words appear constantly in fragrance queries
 * ("men perfumes", "for women", "a man can wear"). Without this filter the
 * fuzzy matcher accepts "men" as the brand "Men" with a perfect 0.000 score,
 * which then fires productsByBrand:"Men" (empty) and — worse — makes the
 * downstream productMatchesIntent filter require the literal token "men" in
 * every product's text, rejecting the whole result set.
 *
 * Built from the genders dictionary so any alias added there is automatically
 * covered here.
 */
const GENDER_WORDS = new Set(
  Object.values(genders)
    .flat()
    .map((word) => word.toLowerCase()),
);

/**
 * Conversational filler words that must NEVER be treated as brand names.
 *
 * The fuzzy matcher is permissive enough that short common words drift onto
 * short brand names: "okay" -> "Olay" (0.25), "for" -> "Storm" (0.33),
 * "can" -> "Araman". These carry no product signal, so any window that is or
 * contains one of them is skipped before matching. Kept in the same spirit as
 * the filler list in expandIntent.js but focused on the tokens that actually
 * cause false brand detections.
 */
const FILLER_NON_BRAND_WORDS = new Set([
  "i",
  "me",
  "my",
  "we",
  "us",
  "you",
  "your",
  "he",
  "she",
  "it",
  "they",
  "him",
  "her",
  "them",
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "and",
  "or",
  "of",
  "to",
  "for",
  "with",
  "about",
  "on",
  "in",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "do",
  "does",
  "did",
  "doing",
  "have",
  "has",
  "had",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "no",
  "not",
  "yes",
  "okay",
  "ok",
  "please",
  "hi",
  "hello",
  "hey",
  "show",
  "find",
  "search",
  "look",
  "looking",
  "want",
  "need",
  "buy",
  "get",
  "got",
  "give",
  "tell",
  "see",
  "seen",
  "make",
  "made",
  "go",
  "going",
  "wear",
  "wearing",
  "attend",
  "stand",
  "out",
  "up",
  "down",
  "day",
  "night",
  "good",
  "great",
  "nice",
  "best",
  "something",
  "anything",
  "some",
  "any",
  "more",
  "else",
  "another",
  "other",
  "what",
  "which",
  "who",
  "how",
  "why",
  "when",
  "where",
  "recommend",
  "recomend",
  "recommed",
  "recommended",
  "recomended",
  "recommendation",
  "recommendations",
  "suggest",
  "sugest",
  "suggestion",
  "seller",
  "sellers",
  "selling",
  "option",
  "options",
  "product",
  "products",
  "item",
  "items",
  "stuff",
  "things",
  "thing",
  "brand",
  "brands",
  "yeah",
  "yep",
  "okay",
]);

/**
 * Minimum character length (ignoring spaces) a token window must reach before
 * it is tested against the brand dictionary.
 *
 * Single short tokens ("i", "a", "me") match almost any brand under Fuse's
 * threshold; requiring a small floor keeps them out of the candidate set.
 */
const MIN_BRAND_PHRASE_LENGTH = 3;

/**
 * Minimum ratio of (matched phrase length) to (brand name length) for a match
 * to be accepted.
 *
 * A short conversational word can fuzzy-match a much longer brand name
 * ("for" -> "Storm"); requiring the phrase to cover at least this fraction of
 * the brand name's characters rejects that drift while still tolerating real
 * typos ("sahib" -> "Sahiib") and short brands ("Ard").
 */
const BRAND_LENGTH_RATIO = 0.7;

/**
 * Rejects a token window if it cannot be a brand mention.
 *
 * Catches the three classes of false positive the fuzzy matcher produces on
 * ordinary English: product-category words ("perfume"), gender words ("men"),
 * and conversational filler ("okay", "for"). The whole phrase and every token
 * within it are checked, so multi-word windows like "for men" are rejected
 * even though the joined phrase itself is not a stop word.
 *
 * @param {string} phrase - The joined window phrase
 * @param {string[]} phraseWords - The individual tokens in the window
 * @returns {boolean} true when the window must not be treated as a brand
 */
function isNonBrandWindow(phrase, phraseWords) {
  if (
    GENERIC_NON_BRAND_WORDS.has(phrase) ||
    GENDER_WORDS.has(phrase) ||
    FILLER_NON_BRAND_WORDS.has(phrase)
  ) {
    return true;
  }

  return phraseWords.some(
    (word) =>
      GENERIC_NON_BRAND_WORDS.has(word) ||
      GENDER_WORDS.has(word) ||
      FILLER_NON_BRAND_WORDS.has(word),
  );
}

/**
 * Detects brands mentioned in the message using a fuzzy sliding-window scan.
 *
 * The previous implementation ran a single Fuse search over the ENTIRE message
 * string, which only matched when the message was essentially just the brand
 * name. Any conversational phrase ("show me sahib", "i want lattafa perfumes")
 * failed to match because Fuse scored the full text.
 *
 * This mirrors the proven pattern in fuzzyDictionaryMatcher.js: tokenize the
 * message, then test 1- to MAX_BRAND_WORDS-word sliding windows against the
 * brand dictionary. The single best-scoring match becomes `brand`; the top two
 * distinct matches populate `comparisonProducts`.
 *
 * Lives in its own module so it can be unit-tested with an in-memory brand
 * list without pulling in the WooCommerce-backed brand dictionary (which would
 * otherwise open a Redis connection during import and stall the test runner).
 *
 * @param {string} message - Raw user message
 * @param {Array} brands - [{ id, name, slug }]
 * @returns {Object} { brand, comparisonProducts }
 */
export function detectBrands(message, brands) {
  if (!brands.length) {
    return { brand: null, comparisonProducts: [] };
  }

  const fuse = new Fuse(brands, {
    keys: ["name", "slug"],
    threshold: BRAND_MATCH_THRESHOLD,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  const tokens = message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Collect every (score, match) pair across all windows, then pick the best.
  const hits = [];

  for (let size = 1; size <= MAX_BRAND_WORDS; size++) {
    for (let start = 0; start + size <= tokens.length; start++) {
      const windowTokens = tokens.slice(start, start + size);
      const phrase = windowTokens.join(" ");
      const phraseNoSpace = phrase.replace(/\s+/g, "");

      // Reject windows that are too short to be a meaningful brand token.
      // Single short words ("i", "a", "me") match almost any brand under
      // the threshold.
      if (phraseNoSpace.length < MIN_BRAND_PHRASE_LENGTH) {
        continue;
      }

      // Reject product-category words ("perfume"), gender words ("men") and
      // conversational filler ("okay", "for") — the three classes of false
      // positive the fuzzy matcher produces on ordinary English. The whole
      // phrase AND every token within it are checked so multi-word windows
      // like "for men" are rejected too.
      if (isNonBrandWindow(phrase, windowTokens)) {
        continue;
      }

      const result = fuse.search(phrase);

      if (result.length && result[0].score <= BRAND_MATCH_THRESHOLD) {
        const match = result[0].item;
        const brandChars = (match.name || "").replace(/\s+/g, "").length;

        // Reject short-word-to-long-brand drift ("for" -> "Storm"). Require the
        // matched phrase to cover at least BRAND_LENGTH_RATIO of the brand
        // name's characters. Real typos ("sahib" -> "Sahiib") and short
        // brands ("Ard") still pass.
        //
        // Exception: when the phrase is a prefix of the brand name
        // ("genie" -> "Genie Collection"), the user typed an intentional
        // abbreviation of the full brand, not drift — accept it.
        const isPrefix =
          (match.name || "").toLowerCase().replace(/[^\w\s]/g, "").trim()
            .startsWith(phrase);

        if (
          brandChars &&
          !isPrefix &&
          phraseNoSpace.length / brandChars < BRAND_LENGTH_RATIO
        ) {
          continue;
        }

        hits.push({ score: result[0].score, item: match });
      }
    }
  }

  if (!hits.length) {
    return { brand: null, comparisonProducts: [] };
  }

  // Sort best (lowest) score first, then de-duplicate by brand id.
  hits.sort((a, b) => a.score - b.score);

  const seen = new Set();
  const unique = [];

  for (const hit of hits) {
    if (seen.has(hit.item.id)) {
      continue;
    }

    seen.add(hit.item.id);
    unique.push(hit.item);

    if (unique.length >= 2) {
      break;
    }
  }

  return {
    brand: unique[0],
    comparisonProducts: unique,
  };
}

export default detectBrands;

/**
 * Checks whether a query mentions a specific brand.
 *
 * Used by the query-expansion layer (expandIntent.js) so a brand detected
 * upstream with a typo ("Sahib" -> "Sahiib") is not stripped by a strict
 * literal check — while an unrelated memory-inherited brand still fails and
 * is dropped. Shares the same window guards as detectBrands so the mention
 * check can never accept a phrase detection would have rejected.
 *
 * @param {string} query - Raw user query
 * @param {Object} brand - { name, slug? }
 * @returns {boolean}
 */
export function isBrandMentioned(query, brand) {
  if (!query || !brand?.name) {
    return false;
  }

  // Literal containment (multi-word fallback handled by the caller).
  if (query.toLowerCase().includes(brand.name.toLowerCase())) {
    return true;
  }

  const brandName = brand.name.toLowerCase();

  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const fuse = new Fuse(
    [{ name: brandName, slug: (brand.slug || "").toLowerCase() }],
    {
      keys: ["name", "slug"],
      threshold: BRAND_MATCH_THRESHOLD,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
    },
  );

  const brandChars = brandName.replace(/\s+/g, "").length;

  for (let size = 1; size <= MAX_BRAND_WORDS; size++) {
    for (let start = 0; start + size <= tokens.length; start++) {
      const windowTokens = tokens.slice(start, start + size);
      const phrase = windowTokens.join(" ");
      const phraseNoSpace = phrase.replace(/\s+/g, "");

      if (phraseNoSpace.length < MIN_BRAND_PHRASE_LENGTH) {
        continue;
      }

      if (isNonBrandWindow(phrase, windowTokens)) {
        continue;
      }

      const result = fuse.search(phrase);

      if (result.length && result[0].score <= BRAND_MATCH_THRESHOLD) {
        const isPrefix = brandName
          .replace(/[^\w\s]/g, "")
          .trim()
          .startsWith(phrase);

        if (
          brandChars &&
          !isPrefix &&
          phraseNoSpace.length / brandChars < BRAND_LENGTH_RATIO
        ) {
          continue;
        }

        return true;
      }
    }
  }

  return false;
}
