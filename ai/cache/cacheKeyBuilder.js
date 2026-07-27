/**
 * Builds deterministic cache keys for Claire.
 *
 * Different phrasings that represent the same intent
 * should produce the same cache key.
 */

function normalize(value) {
  if (!value) return "";

  return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}

export function buildCacheKey(intent) {
  const parts = [];

  // Version
  parts.push("v1");

  // Intent
  parts.push(intent.type);

  // Brand
  if (intent.brand) {
    parts.push(`brand=${normalize(intent.brand.slug || intent.brand.name)}`);
  }

  // Product Type
  if (intent.productType) {
    parts.push(`type=${normalize(intent.productType)}`);
  }

  // Gender
  if (intent.gender) {
    parts.push(`gender=${normalize(intent.gender)}`);
  }

  // Occasion
  if (intent.occasion) {
    parts.push(`occasion=${normalize(intent.occasion)}`);
  }

  // Fragrance Note
  if (intent.note) {
    parts.push(`note=${normalize(intent.note)}`);
  }

  return parts.join(":");
}

export default {
  buildCacheKey,
};
