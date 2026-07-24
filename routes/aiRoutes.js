import express from "express";

import { chatWithClaire, aiHealth } from "../controllers/aiController.js";

import { verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();

/**
 * Health Check
 */
router.get("/ai/health", aiHealth);

/**
 * Chat with Claire
 *
 * Protected because we want access
 * to the logged in customer.
 */
router.post("/ai/chat", chatWithClaire);

export default router;
