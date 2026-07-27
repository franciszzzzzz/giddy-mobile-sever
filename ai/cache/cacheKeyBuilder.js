/**
 * Builds deterministic cache keys for Claire.
 *
 * Similar requests should share the same cache key,
 * while unrelated searches should not.
 */

function normalize(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function buildCacheKey(intent) {
  const parts = [];

  //
  // -------------------------
  // Version
  // -------------------------
  //

  parts.push("v1");

  //
  // -------------------------
  // Intent
  // -------------------------
  //

  parts.push(intent.type);

  //
  // -------------------------
  // Brand
  // -------------------------
  //

  if (intent.brand) {
    parts.push(`brand=${normalize(intent.brand.slug || intent.brand.name)}`);
  }

  //
  // -------------------------
  // Excluded Brand
  // -------------------------
  //

  if (intent.excludeBrand) {
    parts.push(
      `exclude=${normalize(
        intent.excludeBrand.slug || intent.excludeBrand.name,
      )}`,
    );
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //

  if (intent.productType) {
    parts.push(`type=${normalize(intent.productType)}`);
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //

  if (intent.gender) {
    parts.push(`gender=${normalize(intent.gender)}`);
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //

  if (intent.occasion) {
    parts.push(`occasion=${normalize(intent.occasion)}`);
  }

  //
  // -------------------------
  // Fragrance Note
  // -------------------------
  //

  if (intent.note) {
    parts.push(`note=${normalize(intent.note)}`);
  }

  //
  // -------------------------
  // Search query
  //
  // Only include the query when we
  // couldn't identify a brand.
  // -------------------------
  //

  if (intent.type === "PRODUCT_SEARCH" && !intent.brand && intent.query) {
    parts.push(`query=${normalize(intent.query)}`);
  }

  return parts.join(":");
}

export default {
  buildCacheKey,
};
