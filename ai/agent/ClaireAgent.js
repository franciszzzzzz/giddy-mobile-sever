import detectIntent from "./intentDetector/index.js";
import retrievalService from "../rag/retrieval.service.js";
import buildPrompt from "../prompts/promptBuilder.js";
import { generate } from "../llm/modelRouter.js";
import buildResponse from "./responseBuilder.js";

import aiCache from "../cache/aiCache.service.js";
import { buildCacheKey } from "../cache/cacheKeyBuilder.js";

import conversationMemory from "../memory/conversationMemory.js";
import resolveIntentWithMemory from "../memory/memoryResolver.js";

import logger from "../../utils/logger.js";

class ClaireAgent {
  /**
   * Main entry point.
   */
  async chat({ message, history = [], user = null, sessionId = "anonymous" }) {
    try {
      logger.info("Claire conversation started.");

      //
      // --------------------------------------------------
      // 1. Detect intent
      // --------------------------------------------------
      //
      const detectedIntent = await detectIntent(message);

      console.log("\n================ DETECTED INTENT ================");
      console.dir(detectedIntent, { depth: null });
      console.log("================================================\n");

      //
      // --------------------------------------------------
      // 2. Load conversation memory
      // --------------------------------------------------
      //
      const memory = conversationMemory.getConversation(sessionId);

      const intent = resolveIntentWithMemory(detectedIntent, memory);

      logger.info({
        message: "Resolved intent",
        intent,
      });

      //
      // --------------------------------------------------
      // 3. Retrieve context
      // --------------------------------------------------
      //
      const context = await retrievalService.retrieveContext(intent);

      logger.info({
        retrievalSource: context.source,
        products: context.products?.length || 0,
      });

      //
      // --------------------------------------------------
      // 4. Decide whether this request should be cached
      // --------------------------------------------------
      //
      const cacheableIntents = [
        "PRODUCT_SEARCH",
        "PRODUCT_RECOMMENDATION",
        "PRODUCT_COMPARISON",
        "FRAGRANCE_EDUCATION",
        "STORE_INFORMATION",
      ];

      const shouldCache =
        cacheableIntents.includes(intent.type) &&
        (!context.products || context.products.length > 0);

      const cacheKey = buildCacheKey(intent);

      //
      // --------------------------------------------------
      // 5. Try Redis
      // --------------------------------------------------
      //
      if (shouldCache) {
        const cached = await aiCache.get(cacheKey);

        if (cached) {
          logger.info({
            message: "Returning cached AI response.",
            cacheKey,
          });

          conversationMemory.updateConversation(sessionId, {
            intent,
            entities: intent,
            context,
            userMessage: message,
            assistantMessage: cached.message,
          });

          return cached;
        }
      }

      //
      // --------------------------------------------------
      // 6. Build Prompt
      // --------------------------------------------------
      //
      const messages = buildPrompt({
        userMessage: message,
        intent,
        context,
        history,
      });

      //
      // --------------------------------------------------
      // 7. Generate AI response
      // --------------------------------------------------
      //
      const result = await generate({
        messages,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      //
      // --------------------------------------------------
      // 8. Build frontend response
      // --------------------------------------------------
      //
      const response = buildResponse({
        intent,
        context,
        ai: result,
      });

      //
      // --------------------------------------------------
      // 9. Cache response (only when appropriate)
      // --------------------------------------------------
      //
      if (shouldCache) {
        await aiCache.set(cacheKey, response);

        logger.info({
          message: "AI response cached.",
          cacheKey,
        });
      }

      //
      // --------------------------------------------------
      // 10. Update conversation memory
      // --------------------------------------------------
      //
      conversationMemory.updateConversation(sessionId, {
        intent,
        entities: intent,
        context,
        userMessage: message,
        assistantMessage: response.message,
      });

      logger.info({
        message: "Conversation memory updated.",
        sessionId,
      });

      return response;
    } catch (error) {
      logger.error(error);

      return {
        success: false,
        error: {
          message: "Claire couldn't process your request.",
        },
      };
    }
  }
}

export default new ClaireAgent();
