import aiProductService from "../../../services/aiProduct.service.js";

import productTypes from "../dictionaries/productTypes.js";

import logger from "../../../utils/logger.js";

let brands = [];

let lastRefresh = 0;

const CACHE_TIME = 1000 * 60 * 60; // 1 hour

/**
 * WooCommerce product tags that are NOT brands.
 *
 * The store's tag list doubles as the brand dictionary, but it also contains
 * demographic tags, generic gift/product tags and stray duplicates. Matching
 * against them caused false-positive brand detections in production, e.g.
 * the word "peefumes" (typo) matching the tag "Perfume", which then fired a
 * bogus products-by-brand retrieval.
 */
const GENERIC_TAG_NAMES = new Set([
  "gift",
  "aftershave",
  "tag",
  "air freshener",
  "sugar",
  "men",
  "women",
  "boys",
  "girls",
  "kids",
  "unisex",
  "hair",
  "hair oil",
  "hair mist",
  "hair food",
  "deep conditioner",
  "leave in conditioner",
  "conditioner",
  "rollon",
  "rollons",
  "roll on",
  "roll ons",
]);

/**
 * Normalizes a tag name for comparison: lowercase, punctuation collapsed.
 *
 * Handles stray data-entry artifacts like the malformed "Rollons," tag.
 */
function normalizeTagName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every product-type alias (perfume, body mist, body spray, candle, ...)
 * flattened into one lookup set. A tag named after a product type is not a
 * brand, regardless of how many products carry it (the "Perfume" tag has
 * 160 products and still must never be detected as a brand).
 */
const PRODUCT_TYPE_ALIASES = new Set(
  Object.values(productTypes)
    .flat()
    .map((alias) => normalizeTagName(alias)),
);

/**
 * Returns true when a WooCommerce tag should be excluded from the brand
 * detection dictionary (generic / demographic / product-type tags).
 */
function isGenericTag(tag) {
  const name = normalizeTagName(tag.name);

  if (!name) {
    return true;
  }

  return GENERIC_TAG_NAMES.has(name) || PRODUCT_TYPE_ALIASES.has(name);
}

export async function getBrands() {
  try {
    const now = Date.now();

    if (brands.length && now - lastRefresh < CACHE_TIME) {
      return brands;
    }

    const data = await aiProductService.getBrands();

    const seenSlugs = new Set();

    brands = data
      .filter((tag) => !isGenericTag(tag))
      .filter((tag) => {
        if (!tag.slug || seenSlugs.has(tag.slug)) {
          return false;
        }

        seenSlugs.add(tag.slug);

        return true;
      })
      .map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
      }));

    lastRefresh = now;

    logger.info({
      message: `Loaded ${brands.length} brands for Claire (${
        data.length - brands.length
      } generic tags excluded)`,
    });

    return brands;
  } catch (error) {
    logger.error(error);

    return brands;
  }
}

export default {
  getBrands,
};
