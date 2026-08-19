import axios from "axios";
import config from "../config.js";
import { PROVIDER_CONFIG } from "./providerConfig.js";
import { PROVIDERS, MODELS } from "../../constants/models.js";
import { AI_ERRORS } from "../../constants/errors.js";

// 1. Updated to point to DeepSeek constants instead of OpenRouter
const providerConfig = PROVIDER_CONFIG[PROVIDERS.DEEPSEEK];

/**
 * DeepSeek Native Axios Client
 */
const client = axios.create({
  baseURL: providerConfig.baseURL, // Will resolve to https://api.deepseek.com

  timeout: config.timeout,

  headers: {
    Authorization: `Bearer ${providerConfig.apiKey}`,
    "Content-Type": "application/json",
    // 2. Removed HTTP-Referer and X-Title headers completely
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
 * Validates DeepSeek response structure.
 *
 * Only `message.content` is treated as the user-facing answer.
 * `message.reasoning_content` is the model's internal chain-of-thought and
 * must NEVER be surfaced (it can leak the system prompt / instructions).
 *
 * NOTE: Some DeepSeek reasoning responses return an EMPTY `content` while
 * filling `reasoning_content`. We intentionally treat that as an INVALID
 * response so the router falls through to the next provider instead of
 * leaking the model's private reasoning to the user.
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
 * 3. Updated model validation for DeepSeek models
 */
function supports(model) {
  return model === MODELS.DEEPSEEK_CHAT;
}

/**
 * Checks whether this provider can be used.
 */
function isAvailable() {
  return Boolean(providerConfig.apiKey);
}

/**
 * Sends a completion request to DeepSeek.
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

      // deepseek-v4-flash is reasoning-capable and can spend the ENTIRE token
      // budget on `reasoning_content`, returning an EMPTY `content` field
      // (finish_reason "length") — which fails validation as INVALID_RESPONSE.
      // `chat_template_kwargs: { thinking: false }` is silently IGNORED by the
      // API; the native switch is the `thinking` struct (verified live:
      // reasoning_tokens drops to 0 and finish_reason is "stop").
      // Harmless on non-reasoning models.
      thinking: {
        type: "disabled",
      },
    });

    if (!isValidResponse(response.data)) {
      return {
        success: false,
        provider: PROVIDERS.DEEPSEEK,
        error: {
          code: AI_ERRORS.INVALID_RESPONSE,
          message: `DeepSeek returned an invalid response (finish_reason: ${
            response.data?.choices?.[0]?.finish_reason || "unknown"
          }).`,
        },
      };
    }

    const usage = response.data.usage || {};

    return {
      success: true,

      provider: PROVIDERS.DEEPSEEK,

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

      provider: PROVIDERS.DEEPSEEK,

      latency: Date.now() - startedAt,

      error: {
        code: mapErrorCode(status),

        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Unknown DeepSeek error.",
      },
    };
  }
}

export { generate, supports, isAvailable };
