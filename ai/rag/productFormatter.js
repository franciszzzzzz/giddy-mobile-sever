import logger from "../../utils/logger.js";

/**
 * Converts a single WooCommerce product into
 * a concise AI-friendly object.
 */
export function formatProduct(product) {
  if (!product) return null;

  const image = product.images?.find((img) => img?.src)?.src ?? null;

  if (!image) {
    logger.warn(`Product ${product.id} has no image.`);
  }

  return {
    id: product.id,

    name: product.name,

    sku: product.sku || null,

    image,

    images:
      product.images?.map((img) => ({
        id: img.id,
        src: img.src,
        thumbnail: img.thumbnail,
        alt: img.alt,
      })) || [],

    price: product.price || null,

    regularPrice: product.regular_price || null,

    salePrice: product.sale_price || null,

    currency: product.currency || "₦",

    stockStatus: product.stock_status || "unknown",

    inStock: product.stock_status === "instock",

    stockQuantity: product.stock_quantity,

    brand: product.tags?.map((tag) => tag.name).join(", ") || null,

    categories: product.categories?.map((category) => category.name) || [],

    shortDescription: cleanText(product.short_description),

    description: cleanText(product.description),

    averageRating: Number(product.average_rating || 0),

    reviewCount: product.rating_count || 0,

    permalink: product.permalink || null,
  };
}

/**
 * Formats multiple products.
 */
export function formatProducts(products = []) {
  return products.map(formatProduct).filter(Boolean);
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
