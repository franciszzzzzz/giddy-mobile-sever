import express from "express";
import { verifyUserAuth } from "../middleware/userAuth.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";
import {
  addToWishlist,
  checkWishlistItem,
  clearWishlist,
  getWishlist,
  getWishlistItemCount,
  removeFromWishlist,
} from "../controllers/wishlistController";

router.post("/wishlist", verifyUserAuth, addToWishlist);

router.get("/wishlist", verifyUserAuth, getWishlist);

router.delete("/wishlist", verifyUserAuth, removeFromWishlist);

router.delete("/wishlist/clear", verifyUserAuth, clearWishlist);

router.get("/wishlist/count", verifyUserAuth, getWishlistItemCount);

router.get("/wishlist/check/:productId", verifyUserAuth, checkWishlistItem);
