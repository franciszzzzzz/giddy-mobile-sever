import axios from "axios";
import config from "../config.js";
import { PROVIDER_CONFIG } from "./providerConfig.js";
import { PROVIDERS, MODELS } from "../../constants/models.js";
import { AI_ERRORS } from "../../constants/errors.js";

const providerConfig = PROVIDER_CONFIG[PROVIDERS.OPENROUTER];
/**
 * OpenRouter Axios Client
 */
const client = axios.create({
  baseURL: providerConfig.baseURL,

  timeout: config.timeout,

  headers: {
    Authorization: `Bearer ${providerConfig.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "http://localhost:5000",
    "X-Title": process.env.APP_NAME || "Claire AI",
  },
});

/**
 * Maps provider HTTP errors to our internal AI errors.
 */
function mapErrorCode(status) {
  switch (status) {
    case 401:
      return AI_ERRORS.UNAUTHORIZED;

    case 404:
      return AI_ERRORS.MODEL_NOT_FOUND;

    case 408:
      return AI_ERRORS.TIMEOUT;

    case 429:
      return AI_ERRORS.RATE_LIMIT;

    default:
      if (status >= 500) {
        return AI_ERRORS.PROVIDER_ERROR;
      }

      return AI_ERRORS.UNKNOWN;
  }
}

/**
 * Validates OpenRouter response structure.
 */
function isValidResponse(data) {
  return (
    data &&
    Array.isArray(data.choices) &&
    data.choices.length > 0 &&
    data.choices[0]?.message?.content
  );
}

/**
 * Returns whether this provider supports a model.
 * OpenRouter supports every model configured through it.
 */

function supports(model) {
  return model === MODELS.OPENROUTER_FREE;
}

/**
 * Checks whether this provider can be used.
 */
function isAvailable() {
  return Boolean(providerConfig.apiKey);
}

/**
 * Sends a completion request to OpenRouter.
 *
 * @param {Object} options
 * @param {string} options.model
 * @param {Array} options.messages
 * @param {number} options.temperature
 * @param {number} options.maxTokens
 *
 * @returns {Promise<Object>}
 */
async function generate({
  model,
  messages,
  temperature = config.temperature,
  maxTokens = config.maxOutputTokens,
}) {
  const startedAt = Date.now();

  try {
    const response = await client.post("/chat/completions", {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    if (!isValidResponse(response.data)) {
      return {
        success: false,
        provider: PROVIDERS.OPENROUTER,
        error: {
          code: AI_ERRORS.INVALID_RESPONSE,
          message: "OpenRouter returned an invalid response.",
        },
      };
    }

    const usage = response.data.usage || {};

    return {
      success: true,

      provider: PROVIDERS.OPENROUTER,

      model,

      latency: Date.now() - startedAt,

      text: response.data.choices[0].message.content,

      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },

      metadata: {
        id: response.data.id || null,
        finishReason: response.data.choices[0].finish_reason || null,
      },
    };
  } catch (error) {
    const status = error.response?.status;

    return {
      success: false,

      provider: PROVIDERS.OPENROUTER,

      latency: Date.now() - startedAt,

      error: {
        code: mapErrorCode(status),

        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Unknown OpenRouter error.",
      },
    };
  }
}

export { generate, supports, isAvailable };
