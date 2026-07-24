import { wc } from "../config/db.js";
import logger from "../utils/logger.js";

import { getCache, setCache, CACHE_TTL } from "../utils/cacheUtils.js";

/**
 * Creates consistent cache keys.
 */
const buildCacheKey = (prefix, data = {}) => {
  return `ai:${prefix}:${JSON.stringify(data)}`;
};

/**
 * Search products by keyword.
 */
export async function searchProducts(query, options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 10;

  const cacheKey = buildCacheKey("search", {
    query,
    page,
    limit,
  });

  const cached = await getCache(cacheKey);

  if (cached) {
    logger.info(`AI Cache Hit -> ${cacheKey}`);
    return cached;
  }

  logger.info(`AI Cache Miss -> ${cacheKey}`);

  const response = await wc.get("/products", {
    params: {
      search: query,
      page,
      per_page: limit,
    },
  });

  await setCache(cacheKey, response.data, CACHE_TTL.PRODUCTS);

  return response.data;
}

/**
 * Get single product.
 */
export async function getProduct(productId) {
  const cacheKey = buildCacheKey("product", {
    productId,
  });

  const cached = await getCache(cacheKey);

  if (cached) {
    logger.info(`AI Cache Hit -> ${cacheKey}`);
    return cached;
  }

  const response = await wc.get(`/products/${productId}`);

  await setCache(cacheKey, response.data, CACHE_TTL.PRODUCT);

  return response.data;
}

/**
 * Get similar products.
 */
export async function getSimilarProducts(productId) {
  const cacheKey = buildCacheKey("similar", {
    productId,
  });

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const product = await getProduct(productId);

  if (!product.categories?.length) {
    return [];
  }

  const categoryId = product.categories[0].id;

  const response = await wc.get("/products", {
    params: {
      category: categoryId,
      per_page: 8,
    },
  });

  const products = response.data
    .filter((item) => item.id !== product.id)
    .slice(0, 5);

  await setCache(cacheKey, products, CACHE_TTL.PRODUCT);

  return products;
}

/**
 * Categories
 */
export async function getCategories() {
  const cacheKey = "ai:categories";

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const response = await wc.get("/products/categories", {
    params: {
      per_page: 100,
    },
  });

  await setCache(cacheKey, response.data, CACHE_TTL.CATEGORIES);

  return response.data;
}

/**
 * Brands
 */
export async function getBrands() {
  const cacheKey = "ai:brands";

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const response = await wc.get("/products/tags", {
    params: {
      per_page: 100,
    },
  });

  await setCache(cacheKey, response.data, CACHE_TTL.BRANDS);

  return response.data;
}

/**
 * Products by category.
 */
export async function getProductsByCategory(category) {
  const cacheKey = buildCacheKey("category", {
    category,
  });

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const categories = await getCategories();

  const selected = categories.find(
    (cat) =>
      cat.name.toLowerCase() === category.toLowerCase() ||
      cat.slug.toLowerCase() === category.toLowerCase(),
  );

  if (!selected) {
    return [];
  }

  const response = await wc.get("/products", {
    params: {
      category: selected.id,
      per_page: 20,
    },
  });

  await setCache(cacheKey, response.data, CACHE_TTL.PRODUCTS);

  return response.data;
}

/**
 * Product of the week.
 */
export async function getProductOfTheWeek() {
  const cacheKey = "ai:product_of_the_week";

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const response = await wc.get("/products", {
    params: {
      orderby: "popularity",
      order: "desc",
      per_page: 1,
    },
  });

  const product = response.data[0] || null;

  await setCache(cacheKey, product, CACHE_TTL.PRODUCT_OF_THE_WEEK);

  return product;
}

/**
 * Featured products.
 */
export async function getFeaturedProducts(limit = 10) {
  const cacheKey = buildCacheKey("featured", {
    limit,
  });

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const response = await wc.get("/products", {
    params: {
      featured: true,
      per_page: limit,
    },
  });

  await setCache(cacheKey, response.data, CACHE_TTL.FEATURED_PRODUCTS);

  return response.data;
}

/**
 * Generic search.
 */
export async function findProducts(filters = {}) {
  const cacheKey = buildCacheKey("filters", filters);

  const cached = await getCache(cacheKey);

  if (cached) return cached;

  const response = await wc.get("/products", {
    params: {
      page: filters.page || 1,
      per_page: filters.limit || 10,

      search: filters.search,

      category: filters.category,

      tag: filters.brand,

      min_price: filters.minPrice,

      max_price: filters.maxPrice,

      stock_status: filters.stockStatus,

      featured: filters.featured,

      on_sale: filters.onSale,
    },
  });

  await setCache(cacheKey, response.data, CACHE_TTL.PRODUCTS);

  return response.data;
}

/**
 * Product exists.
 */
export async function productExists(productId) {
  try {
    await getProduct(productId);

    return true;
  } catch {
    return false;
  }
}

export default {
  searchProducts,
  getProduct,
  getSimilarProducts,
  getCategories,
  getBrands,
  getProductsByCategory,
  getProductOfTheWeek,
  getFeaturedProducts,
  findProducts,
  productExists,
};
export async function getProductsByBrand(brand) {
  const brands = await getBrands();

  const selected = brands.find(
    (item) =>
      item.name.toLowerCase() === brand.toLowerCase() ||
      item.slug.toLowerCase() === brand.toLowerCase(),
  );

  if (!selected) {
    return [];
  }

  const response = await wc.get("/products", {
    params: {
      tag: selected.id,
      per_page: 50,
    },
  });

  return response.data;
}
