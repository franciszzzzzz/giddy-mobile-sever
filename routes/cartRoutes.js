import express from "express";
import { cache, cacheDebugger } from "../middleware/cache.js";
import { verifyUserAuth } from "../middleware/userAuth.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";
import { addToCart } from "../controllers/cart.controller.js";

const router = express.Router();
router.route("/cart/items").post(verifyUserAuth, addToCart);

export default router;
