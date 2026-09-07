function contains(searchable, value) {
  if (!value) {
    return true;
  }

  return searchable.includes(value.toLowerCase());
}

/**
 * Normalizes a product type key into a searchable phrase.
 *
 * Handles both snake_case ("body_mist") and camelCase ("bodyMist")
 * by converting them to space-separated words ("body mist").
 */
function normalizeProductType(productType) {
  return productType
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

export default function productMatchesIntent(product, intent = {}) {
  if (!product) {
    return false;
  }

  const searchable = [
    product.name,

    ...(product.categories || []).map((category) => category.name),

    ...(product.tags || []).map((tag) => tag.name),

    product.short_description,

    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  //
  // -----------------------------
  // Brand
  // -----------------------------
  //
  if (intent.brand && !contains(searchable, intent.brand.name)) {
    return false;
  }

  //
  // -----------------------------
  // Product Type
  // -----------------------------
  //
  if (intent.productType) {
    const productTypeTerm = normalizeProductType(intent.productType);

    if (!contains(searchable, productTypeTerm)) {
      return false;
    }
  }

  // Gender, occasion and fragrance note are recommendation preferences, not
  // reliable hard filters. WooCommerce product records frequently omit those
  // words even when a product is suitable, so enforcing them here used to
  // discard every category/type candidate and return no product cards. The
  // ranker still uses matching metadata to boost the most relevant products.

  //
  // -----------------------------
  // Excluded Brand
  // -----------------------------
  //
  if (intent.excludeBrand && contains(searchable, intent.excludeBrand.name)) {
    return false;
  }

  return true;
}
