import config from "./config.js";
import providers from "./providers/index.js";

import logger from "../../utils/logger.js";

import { AI_ERRORS } from "../constants/errors.js";

/**
 * Routes AI requests through the configured providers.
 * Providers are tried in the order defined in config.providerPriority.
 *
 * @param {Object} options
 * @param {Array} options.messages
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 *
 * @returns {Promise<Object>}
 */
export async function generate({
  messages,
  temperature = config.temperature,
  maxTokens = config.maxOutputTokens,
}) {
  let lastError = null;

  for (const route of config.providerPriority) {
    const provider = providers[route.provider];

    if (!provider) {
      logger.warn({
        provider: route.provider,
        message: "Provider is not registered.",
      });

      continue;
    }

    const service = provider.service;

    try {
      const available = await service.isAvailable();

      if (!available) {
        logger.warn({
          provider: route.provider,
          model: route.model,
          message: "Provider unavailable.",
        });

        continue;
      }

      logger.info({
        provider: route.provider,
        model: route.model,
        message: "Trying provider...",
      });

      const response = await service.generate({
        model: route.model,
        messages,
        temperature,
        maxTokens,
      });

      if (response.success) {
        logger.info({
          provider: response.provider,
          model: response.model,
          totalTokens: response.usage?.totalTokens || 0,
          message: "Provider succeeded.",
        });

        return response;
      }

      lastError = response.error;

      logger.warn({
        provider: route.provider,
        model: route.model,
        error: response.error,
        message: "Provider failed. Trying next provider.",
      });
    } catch (error) {
      lastError = {
        code: AI_ERRORS.PROVIDER_ERROR,
        message: error.message,
      };

      logger.error({
        provider: route.provider,
        model: route.model,
        error: error.message,
        message: "Unexpected provider error.",
      });
    }
  }

  logger.error({
    message: "All configured AI providers failed.",
    error: lastError,
  });

  return {
    success: false,

    error: lastError || {
      code: AI_ERRORS.PROVIDER_ERROR,
      message: "No AI provider could process this request.",
    },
  };
}
