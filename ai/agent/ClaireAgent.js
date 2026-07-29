import { generate } from "../llm/modelRouter.js";
import logger from "../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Claire Agent
 * --------------------------------------------------------
 *
 * ClaireAgent is responsible ONLY for communicating
 * with the Language Model.
 *
 * Everything else is handled by the AI Pipeline.
 */

class ClaireAgent {
  /**
   * Send prompt messages to the configured LLM.
   *
   * @param {Array} messages
   * @returns {Promise<Object>}
   */
  async chat(messages = []) {
    try {
      logger.info({
        message: "Generating AI response.",
      });

      const result = await generate({
        messages,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      logger.info({
        message: "AI response generated.",
        provider: result.provider,
        model: result.model,
      });

      return result;
    } catch (error) {
      logger.error(error);

      return {
        success: false,
        error: {
          message: "Claire couldn't generate a response.",
        },
      };
    }
  }
}

export default new ClaireAgent();
