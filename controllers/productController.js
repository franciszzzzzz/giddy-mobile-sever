import { wc } from "../config/db.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import productModel from "../models/productModel.js";
import { clearProductsCache } from "../utils/cacheUtils.js";
import { uploadToCloudinary } from "../utils/cloudinaryService.js";
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

//2️⃣ get all products
// export const getAllProduct = handleAsyncError(async (req, res, next) => {
//   const resultPerPage = Number(req.query.limit) || 20;
//   const page = Number(req.query.page) || 1;

//   try {
//     const response = await wc.get("/products", {
//       params: {
//         page,
//         per_page: resultPerPage,
//         search: req.query.keyword,
//         category: req.query.category,
//         tag: req.query.tag,
//         featured: req.query.featured,
//         on_sale: req.query.onSale,
//         stock_status: req.query.stockStatus,
//         min_price: req.query.minPrice,
//         max_price: req.query.maxPrice,
//         orderby: req.query.orderby,
//         order: req.query.order,
//       },
//     });

//     const products = response.data;

//     if (!products || products.length === 0) {
//       return next(new HandleError("No products found", 404));
//     }

//     res.status(200).json({
//       success: true,

//       products,

//       resultPerPage,

//       currentPage: page,

//       count: products.length,
//     });
//   } catch (error) {
//     console.error(
//       "PRODUCT FETCH ERROR:",
//       error.response?.data || error.message,
//     );

//     return next(new HandleError("Unable to fetch products", 500));
//   }
// });

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
  const { maxPrice } = req.query;

  // Fetch all categories
  const categoryResponse = await wc.get("/products/categories", {
    params: {
      per_page: 100, // Increased to get all categories
    },
  });

  const categories = categoryResponse.data;

  // Find parent group
  const parent = categories.find(
    (category) =>
      category.name.toLowerCase() === group.toLowerCase() ||
      category.slug.toLowerCase() === group.toLowerCase(),
  );

  if (!parent) {
    // 🔍 Return helpful error with available categories
    const availableCategories = categories
      .filter((c) => c.parent === 0 || c.parent === null) // Only top-level categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        // Show the exact strings you should use
        useName: c.name,
        useSlug: c.slug,
      }));

    return next(
      new HandleError(
        `"${group}" category not found. Available top-level categories you can use: ${availableCategories.map((c) => `"${c.name}" (slug: "${c.slug}")`).join(", ")}`,
        404,
      ),
    );
  }

  // Find child categories
  const childCategories = categories.filter(
    (category) => category.parent === parent.id,
  );

  // Parent + children IDs
  const categoryIds = [
    parent.id,
    ...childCategories.map((category) => category.id),
  ];

  // Fetch products
  const responses = await Promise.all(
    categoryIds.map((id) =>
      wc.get("/products", {
        params: {
          category: id,
          per_page: 20,
        },
      }),
    ),
  );

  // Remove duplicates
  const productMap = new Map();

  responses.forEach((response) => {
    response.data.forEach((product) => {
      productMap.set(product.id, product);
    });
  });

  let products = [...productMap.values()];

  // Apply price filter only if provided
  if (maxPrice) {
    products = products.filter(
      (product) => Number(product.price) <= Number(maxPrice),
    );
  }

  // 🔍 Also return the exact category used
  res.status(200).json({
    success: true,
    group: parent.name,
    groupSlug: parent.slug,
    groupId: parent.id,
    message: `Use "/products/group/${parent.slug}" or "/products/group/${parent.name}"`,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    count: products.length,
    categoriesUsed: categoryIds,
    products,
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

// 🆕 NEW ARRIVALS - Recently created OR recently restocked products
export const getNewArrivals = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const DAY = 24 * 60 * 60 * 1000;

  const now = new Date();

  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY);

  let currentPage = 1;
  let allProducts = [];
  let hasMore = true;

  while (hasMore) {
    const response = await wc.get("/products", {
      params: {
        page: currentPage,
        per_page: 20,
      },
    });

    allProducts.push(...response.data);

    if (response.data.length < 100) {
      hasMore = false;
    } else {
      currentPage++;
    }
  }

  const newArrivals = allProducts.filter((product) => {
    const created = new Date(product.date_created);
    const modified = new Date(product.date_modified);

    return (
      created >= thirtyDaysAgo ||
      (modified >= sevenDaysAgo && product.stock_status === "instock")
    );
  });

  newArrivals.sort((a, b) => {
    return (
      new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );
  });

  const start = (page - 1) * limit;
  const paginatedProducts = newArrivals.slice(start, start + limit);

  res.status(200).json({
    success: true,
    count: newArrivals.length,
    currentPage: page,
    totalPages: Math.ceil(newArrivals.length / limit),
    products: paginatedProducts,
  });
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
      reviewer: req.user.name,
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

//1️⃣ creating products
export const createProducts = handleAsyncError(async (req, res, next) => {
  console.log("🟢 [PRODUCT CREATE] Starting product creation...");

  const { name, price, description, category, stock } = req.body;

  // ✅ Better validation
  if (!name || !price || !description || !category || !stock) {
    console.log("❌ [PRODUCT CREATE] Missing required fields:", {
      name: !!name,
      price: !!price,
      description: !!description,
      category: !!category,
      stock: !!stock,
    });
    return next(new HandleError("All fields are required", 400));
  }

  let image = [];

  // 1️⃣ If multiple files exist
  if (req.files && req.files.length > 0) {
    console.log("🟢 [PRODUCT CREATE] Uploading", req.files.length, "images...");

    try {
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer, "products"),
      );

      const results = await Promise.all(uploadPromises);
      console.log("🟢 [PRODUCT CREATE] Cloudinary upload successful");

      image = results.map((result) => ({
        public_id: result.public_id,
        url: result.secure_url,
      }));
    } catch (uploadError) {
      console.error(
        "❌ [PRODUCT CREATE] Cloudinary upload failed:",
        uploadError,
      );
      return next(new HandleError("Image upload failed", 500));
    }
  }

  // 2️⃣ Create product with image info
  console.log("🟢 [PRODUCT CREATE] Creating product in database...");

  try {
    const product = await productModel.create({
      name,
      price,
      description,
      category,
      stock,
      image,
      user: req.user.id,
    });

    console.log(
      "✅ [PRODUCT CREATE] Product created successfully:",
      product._id,
    );

    // 🗑️ CLEAR CACHE AFTER CREATION
    await clearProductsCache();

    res.status(201).json({
      success: true,
      product,
    });
  } catch (dbError) {
    console.error("❌ [PRODUCT CREATE] Database error:", dbError);
    return next(new HandleError("Database error creating product", 500));
  }
});
//3️⃣update product
export const updateProduct = handleAsyncError(async (req, res, next) => {
  console.log("🟢 [PRODUCT UPDATE] Starting product update...");

  try {
    // ... your existing update logic ...

    // 4️⃣ Save updated product
    console.log("🟢 [PRODUCT UPDATE] Saving to database...");
    const updatedProduct = await product.save();
    console.log(
      "✅ [PRODUCT UPDATE] Product updated successfully:",
      updatedProduct._id,
    );

    // 🗑️ CLEAR CACHE AFTER UPDATE
    await clearProductsCache();

    res.status(200).json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("❌ [PRODUCT UPDATE] Unexpected error:", error);
    return next(
      new HandleError("Internal server error: " + error.message, 500),
    );
  }
});

//4️⃣ delete product
export const deleteProduct = handleAsyncError(async (req, res, next) => {
  try {
    // 1️⃣ Find the product first
    const product = await productModel.findById(req.params.id);

    if (!product) {
      return next(new HandleError("Product not found", 404));
    }

    // ... your existing delete logic ...

    // 3️⃣ Delete the product document from the database
    await productModel.findByIdAndDelete(req.params.id);
    console.log("✅ Product deleted from database");

    // 🗑️ CLEAR CACHE AFTER DELETION
    await clearProductsCache();

    // 4️⃣ Send response
    res.status(200).json({
      success: true,
      message: "Product and associated images deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error in deleteProduct:", error);
    return next(new HandleError("Failed to delete product", 500));
  }
});

// 9️⃣ Admin Getting All Products
export const getAdminProduct = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [products, totalProducts, inStock, outOfStock, totalReviewsAgg] =
    await Promise.all([
      productModel.find().skip(skip).limit(limit),
      productModel.countDocuments(),
      productModel.countDocuments({ stock: { $gt: 0 } }),
      productModel.countDocuments({ stock: { $eq: 0 } }),
      // Sum of numberOfReviews across all products
      productModel.aggregate([
        { $group: { _id: null, totalReviews: { $sum: "$numberOfReviews" } } },
      ]),
    ]);

  const totalReviews =
    Array.isArray(totalReviewsAgg) && totalReviewsAgg[0]?.totalReviews
      ? totalReviewsAgg[0].totalReviews
      : 0;

  res.status(200).json({
    success: true,
    products,
    totalProducts,
    inStock,
    outOfStock,
    totalReviews,
    currentPage: page,
    totalPages: Math.ceil(totalProducts / limit),
    resultPerPage: limit,
  });
});
