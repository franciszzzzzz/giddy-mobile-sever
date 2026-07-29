/**
 * Product Ranker
 *
 * Responsible for scoring and sorting products
 * according to how well they satisfy the user's intent.
 *
 * Retrieval finds products.
 * Ranking decides which products should appear first.
 */

const SCORES = {
  INSTOCK: 100,

  FEATURED: 30,

  ON_SALE: 20,

  BRAND: 80,

  PRODUCT_TYPE: 60,

  GENDER: 40,

  OCCASION: 20,

  NOTE: 20,

  QUERY: 120,

  BUDGET: 50,

  EXCLUDED_BRAND: -1000,
};

/**
 * Builds one searchable string from the product.
 */
function buildSearchableText(product) {
  return [
    product.name,

    ...(product.categories || []).map((c) => c.name),

    ...(product.tags || []).map((t) => t.name),

    product.short_description,

    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Checks whether searchable text contains a value.
 */
function matches(searchable, value) {
  if (!value) {
    return false;
  }

  return searchable.includes(String(value).toLowerCase());
}

/**
 * Placeholder for future personalization.
 */
function scorePersonalization() {
  return 0;
}

/**
 * Calculates relevance score for one product.
 */
function scoreProduct(product, intent = {}) {
  let score = 0;

  const searchable = buildSearchableText(product);

  //
  // -------------------------
  // Stock
  // -------------------------
  //

  if (product.stock_status === "instock") {
    score += SCORES.INSTOCK;
  }

  //
  // -------------------------
  // Featured
  // -------------------------
  //

  if (product.featured) {
    score += SCORES.FEATURED;
  }

  //
  // -------------------------
  // Sale
  // -------------------------
  //

  if (product.on_sale) {
    score += SCORES.ON_SALE;
  }

  //
  // -------------------------
  // Rating
  // -------------------------
  //

  score += Number(product.average_rating || 0) * 5;

  //
  // -------------------------
  // Sales
  // -------------------------
  //

  score += Math.min(Number(product.total_sales || 0), 100);

  //
  // -------------------------
  // Brand
  // -------------------------
  //

  if (intent.brand && matches(searchable, intent.brand.name)) {
    score += SCORES.BRAND;
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //

  if (intent.productType) {
    const productTypeTerm = intent.productType
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase();

    if (matches(searchable, productTypeTerm)) {
      score += SCORES.PRODUCT_TYPE;
    }
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //

  if (intent.gender && matches(searchable, intent.gender)) {
    score += SCORES.GENDER;
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //

  if (intent.occasion && matches(searchable, intent.occasion)) {
    score += SCORES.OCCASION;
  }

  //
  // -------------------------
  // Fragrance Note
  // -------------------------
  //

  if (intent.note && matches(searchable, intent.note)) {
    score += SCORES.NOTE;
  }

  //
  // -------------------------
  // Exact Query
  // -------------------------
  //

  if (intent.query && matches(searchable, intent.query)) {
    score += SCORES.QUERY;
  }

  //
  // -------------------------
  // Budget
  // -------------------------
  //

  if (intent.maxPrice) {
    const price = Number(product.price || 0);

    if (price <= intent.maxPrice) {
      score += SCORES.BUDGET;
    } else {
      score -= SCORES.BUDGET;
    }
  }

  //
  // -------------------------
  // Excluded Brand
  // -------------------------
  //

  if (intent.excludeBrand && matches(searchable, intent.excludeBrand.name)) {
    score += SCORES.EXCLUDED_BRAND;
  }

  //
  // -------------------------
  // Future Personalization
  // -------------------------
  //

  score += scorePersonalization(product, intent);

  return score;
}

/**
 * Ranks products from most relevant
 * to least relevant.
 */
export function rankProducts(products = [], intent = {}) {
  return [...products]
    .map((product) => ({
      product,
      score: scoreProduct(product, intent),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
}

export default {
  rankProducts,
};
