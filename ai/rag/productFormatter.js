import logger from "../../utils/logger.js";

/**
 * Converts a single WooCommerce product into
 * a concise AI-friendly object.
 */
export function formatProduct(product) {
  if (!product) return null;

  return {
    id: product.id,

    name: product.name,

    sku: product.sku || null,

    price: product.price || null,

    regularPrice: product.regular_price || null,

    salePrice: product.sale_price || null,

    currency: product.currency || null,

    stockStatus: product.stock_status || "unknown",

    inStock: product.stock_status === "instock",

    brand: product.tags?.map((tag) => tag.name).join(", ") || null,

    categories: product.categories?.map((category) => category.name) || [],

    shortDescription: cleanText(product.short_description),

    description: cleanText(product.description),

    averageRating: product.average_rating || null,

    reviewCount: product.rating_count || 0,

    permalink: product.permalink || null,
  };
}

/**
 * Formats multiple products.
 */
export function formatProducts(products = []) {
  return products.map(formatProduct);
}

/**
 * Removes HTML from WooCommerce descriptions.
 */
function cleanText(text = "") {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default {
  formatProduct,
  formatProducts,
};
