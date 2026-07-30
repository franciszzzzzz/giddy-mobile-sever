import { wc } from "../config/db.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import productModel from "../models/productModel.js";
import { clearProductsCache } from "../utils/cacheUtils.js";
import HandleError from "../utils/handleError.js";

export const testMainRedis = async (req, res) => {
  try {
    console.log("🔧 [MAIN REDIS TEST] Testing main Redis client...");

    // Test connection
    const isHealthy = await redisClient.healthCheck();
    console.log("🔧 [MAIN REDIS TEST] Health check:", isHealthy);

    // Test setting a key
    await redisClient.setEx("main_redis_test", 60, "working");
    console.log("🔧 [MAIN REDIS TEST] Set key successfully");

    // Test getting the key
    const value = await redisClient.get("main_redis_test");
    console.log("🔧 [MAIN REDIS TEST] Got key:", value);

    // Test keys pattern
    const keys = await redisClient.keys("*");
    console.log("🔧 [MAIN REDIS TEST] All keys:", keys);

    res.json({
      mainRedis: {
        healthy: isHealthy,
        testKey: value,
        allKeys: keys,
      },
    });
  } catch (error) {
    console.error("❌ [MAIN REDIS TEST] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
// In your productController.js
export const checkCacheManually = async (req, res) => {
  const productsKey = "/api/v1/products?page=1";

  console.log("\n🔍 [MANUAL CACHE CHECK] ===== START =====");
  console.log("🔍 Checking cache for:", productsKey);

  try {
    const cached = await redisClient.get(productsKey);
    console.log("📦 Cache exists:", !!cached);

    if (cached) {
      const data = JSON.parse(cached);
      console.log("📊 Cached data has", data.products?.length, "products");
      console.log(
        "📝 Cached product names:",
        data.products?.map((p) => p.name),
      );
    }

    // Check database
    const dbProducts = await productModel
      .find()
      .sort({ createdAt: -1 })
      .limit(5);
    console.log("🗄️ Database has", dbProducts.length, "products");
    console.log(
      "📝 Latest products in DB:",
      dbProducts.map((p) => p.name),
    );

    // Check all Redis keys
    const allKeys = await redisClient.keys("*");
    console.log("🔑 All Redis keys:", allKeys);

    console.log("🔍 [MANUAL CACHE CHECK] ===== END =====");

    res.json({
      cacheExists: !!cached,
      cachedProductCount: cached ? JSON.parse(cached).products?.length : 0,
      databaseProductCount: await productModel.countDocuments(),
      allKeys: allKeys,
    });
  } catch (error) {
    console.error("❌ [MANUAL CHECK] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get Categories For Products
export const getCategories = handleAsyncError(async (req, res, next) => {
  const response = await wc.get("/products/categories");

  res.status(200).json({
    success: true,
    categories: response.data,
  });
});

//new endpoint i am trying to add to get all products with filters and pagination
export const getAllProduct = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const {
    search,
    category,
    tag,
    featured,
    onSale,
    stockStatus,
    minPrice,
    maxPrice,
    sort,
  } = req.query;

  // Translate frontend sort values into WooCommerce values
  let orderby;
  let order = "desc";

  switch (sort) {
    case "bestsellers":
      orderby = "popularity";
      break;

    case "newest":
      orderby = "date";
      break;

    case "rating":
      orderby = "rating";
      break;

    case "price-low-high":
      orderby = "price";
      order = "asc";
      break;

    case "price-high-low":
      orderby = "price";
      order = "desc";
      break;

    default:
      break;
  }

  // Build WooCommerce params dynamically
  const params = {
    page,
    per_page: limit,
  };
  console.log("🔍 [PRODUCT FETCH] Params:", params);
  if (search) params.search = search.trim();

  if (category) params.category = category;

  if (tag) params.tag = tag;

  if (featured === "true") params.featured = true;

  if (onSale === "true") params.on_sale = true;

  if (stockStatus) params.stock_status = stockStatus;

  if (minPrice) params.min_price = minPrice;

  if (maxPrice) params.max_price = maxPrice;

  if (orderby) params.orderby = orderby;

  if (order) params.order = order;

  try {
    const response = await wc.get("/products", {
      params,
    });

    // console.table(
    //   response.data
    //     .filter((p) => p.name.toLowerCase().includes("storm"))
    //     .map((p) => ({
    //       id: p.id,
    //       name: p.name,
    //       categories: p.categories.map((c) => c.name).join(", "),
    //     })),
    // );
    const products = response.data;

    return res.status(200).json({
      success: true,

      pagination: {
        page,
        limit,
        returned: products.length,
      },

      filters: {
        search: search || null,
        category: category || null,
        tag: tag || null,
        featured: featured || false,
        onSale: onSale || false,
        stockStatus: stockStatus || null,
        minPrice: minPrice || null,
        maxPrice: maxPrice || null,
        sort: sort || null,
      },

      count: products.length,

      products,
    });
  } catch (error) {
    console.error(
      "PRODUCT FETCH ERROR:",
      error.response?.data || error.message,
    );

    return next(new HandleError("Unable to fetch products", 500));
  }
});
// Get Product Brands
export const getBrands = handleAsyncError(async (req, res, next) => {
  const response = await wc.get("/products/tags", {
    params: {
      per_page: 100,
    },
  });

  res.status(200).json({
    success: true,
    brands: response.data,
  });
});

// Get Products By Group or Price
export const getProductsByGroup = handleAsyncError(async (req, res, next) => {
  const { group } = req.params;
  const { maxPrice, sort, page = 1, limit = 20 } = req.query;

  const currentPage = Number(page);
  const perPage = Number(limit);

  //
  // Fetch Categories
  //

  const { data: categories } = await wc.get("/products/categories", {
    params: {
      per_page: 100,
    },
  });

  let categoryIds = [];
  let groupInfo = null;

  //
  // Kids
  //

  if (group.toLowerCase() === "kids") {
    const boys = categories.find(
      (c) => c.slug.toLowerCase() === "boys" || c.name.toLowerCase() === "boys",
    );

    const girls = categories.find(
      (c) =>
        c.slug.toLowerCase() === "girls" || c.name.toLowerCase() === "girls",
    );

    if (!boys && !girls) {
      return next(new HandleError("Kids categories not found.", 404));
    }

    const collectChildren = (parent) => {
      if (!parent) return [];

      const children = categories.filter(
        (category) => category.parent === parent.id,
      );

      return [parent.id, ...children.map((c) => c.id)];
    };

    categoryIds = [...collectChildren(boys), ...collectChildren(girls)];

    categoryIds = [...new Set(categoryIds)];

    groupInfo = {
      id: 0,
      name: "Kids",
      slug: "kids",
    };
  } else {
    //
    // Normal Parent Category
    //

    const parent = categories.find(
      (category) =>
        category.parent === 0 &&
        category.slug.toLowerCase() === group.toLowerCase(),
    );

    if (!parent) {
      const availableCategories = categories
        .filter((c) => c.parent === 0)
        .map((c) => c.slug);

      return next(
        new HandleError(
          `"${group}" category not found. Available: ${availableCategories.join(
            ", ",
          )}`,
          404,
        ),
      );
    }

    const children = categories.filter(
      (category) => category.parent === parent.id,
    );

    categoryIds = [parent.id, ...children.map((c) => c.id)];

    groupInfo = {
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
    };
  }

  //
  // Fetch Products For Every Category
  //

  const responses = await Promise.all(
    categoryIds.map((id) =>
      wc.get("/products", {
        params: {
          category: id,
          per_page: 100,
        },
      }),
    ),
  );

  //
  // Remove Duplicates
  //

  const productMap = new Map();

  responses.forEach((response) => {
    response.data.forEach((product) => {
      productMap.set(product.id, product);
    });
  });

  let products = [...productMap.values()];

  //
  // Price Filter
  //

  if (maxPrice) {
    products = products.filter(
      (product) => Number(product.price || 0) <= Number(maxPrice),
    );
  }

  //
  // Sorting
  //

  switch (sort) {
    case "bestsellers":
      products.sort(
        (a, b) => Number(b.total_sales || 0) - Number(a.total_sales || 0),
      );
      break;

    case "newest":
      products.sort(
        (a, b) => new Date(b.date_created) - new Date(a.date_created),
      );
      break;

    case "price-low-high":
      products.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      break;

    case "price-high-low":
      products.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      break;

    case "rating":
      products.sort(
        (a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0),
      );
      break;

    default:
      break;
  }

  //
  // Pagination (AFTER merge + sort + filter)
  //

  const totalProducts = products.length;

  const totalPages = Math.ceil(totalProducts / perPage);

  const startIndex = (currentPage - 1) * perPage;

  const endIndex = startIndex + perPage;

  const paginatedProducts = products.slice(startIndex, endIndex);

  //
  // Response
  //

  return res.status(200).json({
    success: true,

    group: groupInfo,

    filters: {
      sort: sort || null,
      maxPrice: maxPrice || null,
    },

    page: currentPage,

    limit: perPage,

    totalProducts,

    totalPages,

    hasNextPage: currentPage < totalPages,

    hasPreviousPage: currentPage > 1,

    count: paginatedProducts.length,

    products: paginatedProducts,
  });
});

// 💎 LUXURY BRANDS - Based on high price threshold
export const getLuxuryBrands = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const LUXURY_PRICE = 50000;

  let currentPage = 1;
  let allProducts = [];
  let hasMore = true;

  while (hasMore) {
    const response = await wc.get("/products", {
      params: {
        page: currentPage,
        per_page: 20, // WooCommerce max
      },
    });

    allProducts.push(...response.data);

    if (response.data.length < 20) {
      hasMore = false;
    } else {
      currentPage++;
    }
  }

  const luxuryProducts = allProducts.filter(
    (product) => Number(product.price || 0) >= LUXURY_PRICE,
  );

  const start = (page - 1) * limit;
  const paginatedProducts = luxuryProducts.slice(start, start + limit);

  res.status(200).json({
    success: true,
    threshold: LUXURY_PRICE,
    count: luxuryProducts.length,
    currentPage: page,
    totalPages: Math.ceil(luxuryProducts.length / limit),
    products: paginatedProducts,
  });
});

// 🔥 POPULAR PRODUCTS - High ratings and reviews (could be considered luxury) not yest worked on
export const getPopularProducts = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  console.log(`🔥 [POPULAR PRODUCTS] Fetching highly rated products`);

  try {
    const products = await productModel
      .find({
        ratings: { $gte: 3 }, // 3+ star ratings
        numberOfReviews: { $gte: 1 }, // At least 1 review
      })
      .sort({ ratings: -1, numberOfReviews: -1 }) // Best ratings + most reviews first
      .limit(limit)
      .skip(skip)
      .exec();

    const totalCount = await productModel.countDocuments({
      ratings: { $gte: 3 },
      numberOfReviews: { $gte: 1 },
    });

    console.log(
      `🔥 [POPULAR PRODUCTS] Found ${products.length} popular products`,
    );

    if (!products || products.length === 0) {
      return next(new HandleError("No popular products found", 404));
    }

    res.status(200).json({
      success: true,
      products,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      criteria: "3+ stars with 1+ reviews",
      message: "Popular products (highly rated)",
    });
  } catch (error) {
    console.error("❌ [POPULAR PRODUCTS] Error:", error);
    return next(new HandleError("Failed to fetch popular products", 500));
  }
});

export const getProductOfTheWeek = handleAsyncError(async (req, res, next) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // ------------------------------------
    // STEP 1: Get all completed orders
    // ------------------------------------
    let page = 1;
    let orders = [];
    let hasMore = true;

    while (hasMore) {
      const response = await wc.get("/orders", {
        params: {
          after: sevenDaysAgo.toISOString(),
          status: "completed",
          page,
          per_page: 20,
        },
      });

      orders.push(...response.data);

      if (response.data.length < 20) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // ------------------------------------
    // STEP 2: Weekly Best Seller
    // ------------------------------------
    if (orders.length > 0) {
      const salesMap = {};

      orders.forEach((order) => {
        order.line_items.forEach((item) => {
          salesMap[item.product_id] =
            (salesMap[item.product_id] || 0) + item.quantity;
        });
      });

      const sortedProducts = Object.entries(salesMap).sort(
        (a, b) => b[1] - a[1],
      );

      if (sortedProducts.length > 0) {
        const bestSellerId = sortedProducts[0][0];
        const weeklySales = sortedProducts[0][1];

        const productResponse = await wc.get(`/products/${bestSellerId}`);

        return res.status(200).json({
          success: true,
          source: "weekly_sales",
          weeklySales,
          product: productResponse.data,
        });
      }
    }

    // ------------------------------------
    // STEP 3: Fallback to popularity
    // ------------------------------------
    const popularProducts = await wc.get("/products", {
      params: {
        orderby: "popularity",
        order: "desc",
        per_page: 1,
      },
    });

    if (!popularProducts.data.length) {
      return next(new HandleError("No products found", 404));
    }

    return res.status(200).json({
      success: true,
      source: "popularity_fallback",
      product: popularProducts.data[0],
    });
  } catch (error) {
    console.error(
      "PRODUCT OF THE WEEK ERROR:",
      error.response?.data || error.message,
    );

    return next(new HandleError("Failed to fetch Product of the Week", 500));
  }
});

// Get Products By Category Name or Slug
export const getProductsByCategory = handleAsyncError(
  async (req, res, next) => {
    const { category } = req.params;

    // Fetch all categories
    const categoryResponse = await wc.get("/products/categories", {
      params: {
        per_page: 20,
      },
    });

    const categories = categoryResponse.data;

    // Find category by name or slug
    const selectedCategory = categories.find(
      (cat) =>
        cat.name.toLowerCase() === category.toLowerCase() ||
        cat.slug.toLowerCase() === category.toLowerCase(),
    );

    if (!selectedCategory) {
      return next(new HandleError("Category not found", 404));
    }

    // Fetch products
    const productResponse = await wc.get("/products", {
      params: {
        category: selectedCategory.id,
        per_page: 20,
      },
    });

    res.status(200).json({
      success: true,
      category: {
        id: selectedCategory.id,
        name: selectedCategory.name,
        slug: selectedCategory.slug,
      },
      count: productResponse.data.length,
      products: productResponse.data,
    });
  },
);

//5️⃣ get single product
export const getSingleProduct = handleAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const productResponse = await wc.get(`/products/${id}`);

  const reviewsResponse = await wc.get("/products/reviews", {
    params: {
      product: id,
    },
  });

  res.status(200).json({
    success: true,

    product: {
      ...productResponse.data,

      reviews: reviewsResponse.data,
    },
  });
});

// GET /products/:id/similar
export const getSimilarProducts = handleAsyncError(async (req, res, next) => {
  const { id } = req.params;

  // Get current product
  const productResponse = await wc.get(`/products/${id}`);

  const product = productResponse.data;

  if (!product) {
    return next(new HandleError("Product not found", 404));
  }

  // Product must belong to at least one category
  if (!product.categories?.length) {
    return res.status(200).json({
      success: true,
      count: 0,
      products: [],
    });
  }

  // Use the first category
  const categoryId = product.categories[0].id;

  // Get products in same category
  const similarResponse = await wc.get("/products", {
    params: {
      category: categoryId,
      per_page: 8,
    },
  });
  const similarProducts = similarResponse.data
    .filter((item) => item.id !== product.id)
    .slice(0, 5);

  res.status(200).json({
    success: true,
    count: similarProducts.length,
    products: similarProducts,
  });
});

export const searchProducts = handleAsyncError(async (req, res, next) => {
  const { q } = req.query;

  const resultPerPage = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;

  if (!q || !q.trim()) {
    return next(new HandleError("Search query is required", 400));
  }
  const search = q.trim();
  try {
    const response = await wc.get("/products", {
      params: {
        search,
        page,
        per_page: resultPerPage,
      },
    });

    const products = response.data;
    res.status(200).json({
      success: true,
      query: q,
      count: products.length,
      currentPage: page,
      resultPerPage,
      products,
    });
  } catch (error) {
    console.error("SEARCH ERROR:", error.response?.data || error.message);

    return next(new HandleError("Unable to search products", 500));
  }
});

// 6️⃣ Creating And Updating Reviews
export const createReviewForProduct = handleAsyncError(
  async (req, res, next) => {
    const { productId, rating, comment } = req.body;

    const response = await wc.post("/products/reviews", {
      product_id: productId,
      review: comment,
      rating: Number(rating),
      reviewer: req.user.firstName,
      reviewer_email: req.user.email,
    });
    console.log("REQ USER:", req.user);
    console.log("Reviewer:", req.user.name);
    console.log("Reviewer Email:", req.user.email);
    res.status(201).json({
      success: true,
      review: response.data,
    });
  },
);

// 7️⃣ Getting Reviews
export const gettingReviewsForProduct = handleAsyncError(
  async (req, res, next) => {
    const productId = req.params.id;
    if (!productId) {
      return next(new HandleError("Product ID is required", 400));
    }

    const response = await wc.get("/products/reviews", {
      params: {
        product: productId,
      },
    });

    res.status(200).json({
      success: true,
      reviews: response.data,
    });
  },
);

// 8️⃣ Deleting Reviews
export const deleteReviewsForProduct = handleAsyncError(
  async (req, res, next) => {
    const { id } = req.params;

    // Fetch review
    const { data: review } = await wc.get(`/products/reviews/${id}`);

    if (!review) {
      return next(new HandleError("Review not found", 404));
    }

    // Ensure the logged-in user owns the review
    if (review.reviewer_email !== req.user.email) {
      return next(
        new HandleError("You are not authorized to delete this review", 403),
      );
    }

    // Delete review
    await wc.delete(`/products/reviews/${id}`, {
      params: {
        force: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  },
);
