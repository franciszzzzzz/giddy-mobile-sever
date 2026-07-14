import express from "express";
import { cache, cacheDebugger } from "../middleware/cache.js";
import { verifyUserAuth } from "../middleware/userAuth.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";
import {
  addToCart,
  clearCart,
  getCart,
  getCartItemCount,
  removeCartItem,
  syncCart,
  updateCartItem,
  validateCart,
} from "../controllers/cart.controller.js";

const router = express.Router();
router.route("/cart/items").post(verifyUserAuth, addToCart);
router.route("/cart").get(verifyUserAuth, getCart);
router
  .route("/cart/items/:productId")
  .patch(verifyUserAuth, updateCartItem)
  .delete(verifyUserAuth, removeCartItem);
router.delete("/cart", verifyUserAuth, clearCart);
router.get("/cart/count", verifyUserAuth, getCartItemCount);
router.post("/cart/validate", verifyUserAuth, validateCart);
router.route("/cart/sync").post(verifyUserAuth, syncCart);
export default router;
