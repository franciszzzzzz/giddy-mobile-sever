import ClaireAgent from "../ai/agent/ClaireAgent.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import logger from "../utils/logger.js";
import providers from "../ai/llm/providers/index.js";
import redisClient from "../config/redis.js";
import runPipeline from "../ai/pipeline/index.js";
import { validateChatInput } from "../ai/safety/inputFilter.js";
import { INTENTS } from "../ai/constants/intents.js";

/**
 * POST /api/v1/ai/chat
 */

export const chatWithClaire = handleAsyncError(async (req, res, next) => {
  const { message } = req.body;

  if (!message?.trim()) {
    return next(new HandleError("Message is required.", 400));
  }

  logger.info({
    message: "Claire chat request received.",
    userId: req.user?.id || null,
  });

  // Safety gate — rejected messages get a canned deflection instead of an
  // LLM answer, so off-store topics and injection attempts cost no tokens.
  const inputCheck = validateChatInput(message);
  if (!inputCheck.ok) {
    logger.warn({
      message: "Claire input rejected by safety filter.",
      code: inputCheck.code,
      userId: req.user?.id || null,
    });

    return res.status(200).json({
      success: true,

      intent: {
        type: INTENTS.UNKNOWN,
        confidence: 1,
      },

      message: inputCheck.message,

      provider: null,

      model: null,

      usage: null,

      context: {
        source: "safety",
        products: [],
        product: null,
        brands: [],
        categories: [],
      },

      suggestions: ["Recommend a perfume", "Browse brands", "Browse categories"],

      timestamp: new Date().toISOString(),
    });
  }

  const state = await runPipeline({
    sessionId: req.user?.id || "anonymous",
    message: message.trim(),
    user: req.user || null,
  });

  if (!state.response?.success) {
    return next(
      new HandleError(
        state.response?.error?.message || "Unable to process AI request.",
        500,
      ),
    );
  }

  logger.info({
    message: "Claire conversation completed.",
    intent: state.intent?.type,
    userId: req.user?.id || null,
  });

  return res.status(200).json(state.response);
});

/**
 * GET /api/v1/ai/health
 *
 * Simple endpoint used to verify that the AI
 * service is alive.
 */
export const aiHealth = handleAsyncError(async (req, res) => {
  const providerStatus = {};

  for (const [name, provider] of Object.entries(providers)) {
    providerStatus[name] = provider.service.isAvailable();
  }

  res.status(200).json({
    success: true,

    service: "Claire AI",

    status: "healthy",

    providers: providerStatus,

    timestamp: new Date().toISOString(),
  });
});

/**
 * /redis/flush
 *
 * Simple endpoint used to flush redis keys
 */

export const flushRedis = async (req, res) => {
  await redisClient.flushAll();

  return res.status(200).json({
    success: true,
    message: "Redis cache cleared.",
  });
};
