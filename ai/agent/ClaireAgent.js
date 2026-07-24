import detectIntent from "./intentDetector/index.js";
import retrievalService from "../rag/retrieval.service.js";
import buildPrompt from "../prompts/promptBuilder.js";
import { generate } from "../llm/modelRouter.js";
import buildResponse from "./responseBuilder.js";
import logger from "../../utils/logger.js";

class ClaireAgent {
  /**
   * Main entry point.
   */
  async chat({ message, history = [], user = null }) {
    try {
      logger.info("Claire conversation started.");

      //
      // 1. Detect intent
      //
      const intent = await detectIntent(message);

      logger.info({
        intent,
      });

      //
      // 2. Retrieve product/store context
      //
      const context = await retrievalService.retrieveContext(intent);

      logger.info({
        retrievalSource: context.source,
      });

      //
      // 3. Build LLM prompt
      //
      const messages = buildPrompt({
        userMessage: message,
        intent,
        context,
        history,
      });

      //
      // 4. Generate AI response
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
      // 5. Build frontend response
      //
      return buildResponse({
        intent,
        context,
        ai: result,
      });
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
