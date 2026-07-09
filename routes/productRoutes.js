import express from "express";
import {
  createProducts,
  createReviewForProduct,
  deleteProduct,
  deleteReviewsForProduct,
  getAdminProduct,
  getAllProduct,
  getBrands,
  getCategories,
  getLuxuryBrands,
  getNewArrivals,
  getPopularProducts,
  getProductOfTheWeek,
  getProductsByCategory,
  getProductsByGroup,
  getSimilarProducts,
  getSingleProduct,
  gettingReviewsForProduct,
  searchProducts,
  updateProduct,
} from "../controllers/productController.js";
import { cache, cacheDebugger } from "../middleware/cache.js";
import { upload } from "../middleware/multer.js";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";
const router = express.Router();

// 🎯 Apply cache debugger to ALL product routes
router.use(cacheDebugger);
// routes
router.route("/products").get(cache(CACHE_TTL.PRODUCTS), getAllProduct);
router.route("/categories").get(cache(CACHE_TTL.CATEGORIES), getCategories);
router.route("/brands").get(cache(CACHE_TTL.BRANDS), getBrands);
router.route("/search").get(cache(CACHE_TTL.PRODUCTS), searchProducts);
router
  .route("/products/group/:group")
  .get(cache(CACHE_TTL.CATEGORIES), getProductsByGroup);
router
  .route("/products/category/:category")
  .get(cache(CACHE_TTL.PRODUCTS), getProductsByCategory);
router
  .route("/products/product-of-the-week")
  .get(cache(CACHE_TTL.PRODUCT_OF_THE_WEEK), getProductOfTheWeek);

router.route("/product/:id").get(cache(CACHE_TTL.PRODUCT), getSingleProduct);
router
  .route("/products/:id/similar")
  .get(cache(CACHE_TTL.PRODUCT), getSimilarProducts);

router
  .route("/products/:id/reviews")
  .get(cache(CACHE_TTL.REVIEWS), gettingReviewsForProduct);
router.route("/review").put(verifyUserAuth, createReviewForProduct);
router.route("/review/:id").delete(verifyUserAuth, deleteReviewsForProduct);

// Admin routes
router
  .route("/admin/products")
  .get(verifyUserAuth, roleBasedAccess("admin"), getAdminProduct);

router
  .route("/admin/product/create")
  .post(
    verifyUserAuth,
    roleBasedAccess("admin"),
    upload.array("image", 5),
    createProducts,
  );

router
  .route("/admin/product/:id")
  .put(
    verifyUserAuth,
    roleBasedAccess("admin"),
    upload.array("image", 5),
    updateProduct,
  )
  .delete(verifyUserAuth, roleBasedAccess("admin"), deleteProduct);

router
  .route("/admin/reviews")
  .get(verifyUserAuth, roleBasedAccess("admin"), gettingReviewsForProduct)
  .delete(verifyUserAuth, roleBasedAccess("admin"), deleteReviewsForProduct);

router.route("/products/new-arrivals").get(getNewArrivals);
router.route("/products/luxury-brands").get(getLuxuryBrands);
router.route("/products/popular-products").get(getPopularProducts);
export default router;
