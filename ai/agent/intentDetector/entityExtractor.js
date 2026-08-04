import Fuse from "fuse.js";

import brandDictionary from "../dynamic/brands.js";
import categoryGroups from "../dictionaries/categoryGroups.js";
import genders from "../dictionaries/genders.js";
import occasions from "../dictionaries/occasions.js";
import fragranceNotes from "../dictionaries/fragranceNotes.js";
import productTypes from "../dictionaries/productTypes.js";

const RECIPIENTS = {
  dad: ["dad", "father", "daddy", "papa"],

  mum: ["mum", "mom", "mother", "mummy"],

  husband: ["husband"],

  wife: ["wife"],

  boyfriend: ["boyfriend"],

  girlfriend: ["girlfriend"],

  brother: ["brother"],

  sister: ["sister"],

  friend: ["friend"],
};

function contains(words, text) {
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

function detectBudget(text) {
  const match =
    text.match(/under\s*₦?\s*([\d,]+)/i) ||
    text.match(/below\s*₦?\s*([\d,]+)/i) ||
    text.match(/less than\s*₦?\s*([\d,]+)/i);

  if (!match) {
    return null;
  }

  return Number(match[1].replace(/,/g, ""));
}

function detectPriceRange(text) {
  const range = text.match(/between\s*₦?\s*([\d,]+)\s+and\s*₦?\s*([\d,]+)/i);

  if (!range) {
    return {
      minPrice: null,
      maxPrice: null,
    };
  }

  return {
    minPrice: Number(range[1].replace(/,/g, "")),
    maxPrice: Number(range[2].replace(/,/g, "")),
  };
}

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
  "lotion",
]);

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
 * @param {string} message - Raw user message
 * @param {Array} brands - [{ id, name, slug }]
 * @returns {Object} { brand, comparisonProducts }
 */
function detectBrands(message, brands) {
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
      const phrase = tokens.slice(start, start + size).join(" ");

      // Reject generic product-category words ("perfume", "cologne", ...)
      // even if the fuzzy matcher accepts them. These describe the product
      // type, not a brand, and would otherwise fire a bogus productsByBrand
      // search (e.g. "recommend a perfume" -> productsByBrand:Perfume).
      if (GENERIC_NON_BRAND_WORDS.has(phrase)) {
        continue;
      }

      const result = fuse.search(phrase);

      if (result.length && result[0].score <= BRAND_MATCH_THRESHOLD) {
        hits.push({ score: result[0].score, item: result[0].item });
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

export default async function extractEntities(message) {
  const text = message.toLowerCase();

  const entities = {
    brand: null,

    excludeBrand: null,

    gender: null,

    occasion: null,

    note: null,

    productType: null,

    categoryGroup: null,
  };
  //
  // -------------------------
  // Brands
  // -------------------------
  //

  const brands = await brandDictionary.getBrands();

  const { brand, comparisonProducts } = detectBrands(message, brands);

  entities.brand = brand;

  if (comparisonProducts.length >= 2) {
    entities.comparisonProducts = comparisonProducts;
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //

  for (const [type, aliases] of Object.entries(productTypes)) {
    if (contains(aliases, text)) {
      entities.productType = type;
      break;
    }
  }

  //
  // -------------------------
  // Category Group
  // -------------------------
  //

  for (const [group, words] of Object.entries(categoryGroups)) {
    if (contains(words, text)) {
      entities.categoryGroup = {
        slug: group,
        name: group.replace(/-/g, " "),
      };

      break;
    }
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //

  for (const [gender, aliases] of Object.entries(genders)) {
    if (contains(aliases, text)) {
      entities.gender = gender;
      break;
    }
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //

  for (const [occasion, aliases] of Object.entries(occasions)) {
    if (contains(aliases, text)) {
      entities.occasion = occasion;
      break;
    }
  }

  //
  // -------------------------
  // Fragrance Note
  // -------------------------
  //

  for (const [note, aliases] of Object.entries(fragranceNotes)) {
    if (contains(aliases, text)) {
      entities.note = note;
      break;
    }
  }

  //
  // -------------------------
  // Recipient
  // -------------------------
  //

  for (const [recipient, aliases] of Object.entries(RECIPIENTS)) {
    if (contains(aliases, text)) {
      entities.recipient = recipient;
      break;
    }
  }

  //
  // -------------------------
  // Budget
  // -------------------------
  //

  entities.budget = detectBudget(text);

  //
  // -------------------------
  // Price Range
  // -------------------------
  //

  const prices = detectPriceRange(text);

  entities.minPrice = prices.minPrice;
  entities.maxPrice = prices.maxPrice;

  return entities;
}
