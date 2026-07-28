import detectIntent from "./intentDetector/index.js";
import retrievalService from "../rag/retrieval.service.js";
import buildPrompt from "../prompts/promptBuilder.js";
import { generate } from "../llm/modelRouter.js";
import buildResponse from "./responseBuilder.js";

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
      // 4. Build Prompt
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
      // 5. Generate AI response
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
      // 6. Build frontend response
      // --------------------------------------------------
      //
      const response = buildResponse({
        intent,
        context,
        ai: result,
      });

      //
      // --------------------------------------------------
      // 7. Update conversation memory
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
