import { generate as generateResponse } from "./modelRouter.js";

import AIError from "../exceptions/AIError.js";
import { AI_ERRORS } from "../constants/errors.js";

import logger from "../../utils/logger.js";

/**
 * Validates chat messages before sending them to the LLM.
 *
 * @param {Array} messages
 */
function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new AIError(
      AI_ERRORS.INVALID_MESSAGES,
      "Messages must be an array.",
      400,
    );
  }

  if (messages.length === 0) {
    throw new AIError(
      AI_ERRORS.INVALID_MESSAGES,
      "At least one message is required.",
      400,
    );
  }

  for (const message of messages) {
    if (
      !message ||
      typeof message !== "object" ||
      typeof message.role !== "string" ||
      typeof message.content !== "string"
    ) {
      throw new AIError(
        AI_ERRORS.INVALID_MESSAGES,
        "Invalid message format.",
        400,
      );
    }

    if (!["system", "user", "assistant"].includes(message.role)) {
      throw new AIError(
        AI_ERRORS.INVALID_MESSAGES,
        `Invalid message role: ${message.role}`,
        400,
      );
    }

    if (!message.content.trim()) {
      throw new AIError(
        AI_ERRORS.INVALID_MESSAGES,
        "Message content cannot be empty.",
        400,
      );
    }
  }
}

/**
 * Main LLM service.
 *
 * This is the ONLY entry point used by the AI platform.
 */
async function generate({ messages, temperature, maxTokens }) {
  validateMessages(messages);

  logger.info({
    messageCount: messages.length,
    message: "Starting AI generation.",
  });

  const response = await generateResponse({
    messages,
    temperature,
    maxTokens,
  });

  if (!response.success) {
    throw new AIError(
      response.error?.code || AI_ERRORS.UNKNOWN,
      response.error?.message || "AI generation failed.",
      500,
      response.error,
    );
  }

  logger.info({
    provider: response.provider,
    model: response.model,
    totalTokens: response.usage?.totalTokens || 0,
    message: "AI generation completed.",
  });

  return {
    provider: response.provider,
    model: response.model,
    text: response.text,
    usage: response.usage,
  };
}

export default {
  generate,
};
