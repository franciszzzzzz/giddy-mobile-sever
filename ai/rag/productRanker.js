/**
 * Scores and sorts retrieved products according to
 * how well they match the customer's intent.
 */

function scoreProduct(product, intent) {
  let score = 0;

  //
  // -------------------------
  // In Stock
  // -------------------------
  //
  if (product.stock_status === "instock") {
    score += 100;
  }

  //
  // -------------------------
  // Featured
  // -------------------------
  //
  if (product.featured) {
    score += 30;
  }

  //
  // -------------------------
  // On Sale
  // -------------------------
  //
  if (product.on_sale) {
    score += 20;
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
  score += Math.min(product.total_sales || 0, 100);

  const searchable = [
    product.name,
    ...(product.categories || []).map((c) => c.name),
    ...(product.tags || []).map((t) => t.name),
  ]
    .join(" ")
    .toLowerCase();

  //
  // -------------------------
  // Brand
  // -------------------------
  //
  if (intent.brand && searchable.includes(intent.brand.name.toLowerCase())) {
    score += 80;
  }

  //
  // -------------------------
  // Product Type
  // -------------------------
  //
  if (
    intent.productType &&
    searchable.includes(intent.productType.replace("_", " "))
  ) {
    score += 60;
  }

  //
  // -------------------------
  // Gender
  // -------------------------
  //
  if (intent.gender && searchable.includes(intent.gender)) {
    score += 40;
  }

  //
  // -------------------------
  // Occasion
  // -------------------------
  //
  if (intent.occasion && searchable.includes(intent.occasion)) {
    score += 20;
  }

  //
  // -------------------------
  // Fragrance Note
  // -------------------------
  //
  if (intent.note && searchable.includes(intent.note)) {
    score += 20;
  }

  return score;
}

export function rankProducts(products = [], intent) {
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
