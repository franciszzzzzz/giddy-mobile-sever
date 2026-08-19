import axios from "axios";

import config from "../config.js";
import { PROVIDER_CONFIG } from "./providerConfig.js";
import { PROVIDERS, MODELS } from "../../constants/models.js";
import { AI_ERRORS } from "../../constants/errors.js";

const providerConfig = PROVIDER_CONFIG[PROVIDERS.GROQ];

/**
 * Groq Axios Client
 */
const client = axios.create({
  baseURL: providerConfig.baseURL,

  timeout: config.timeout,

  headers: {
    Authorization: `Bearer ${providerConfig.apiKey}`,
    "Content-Type": "application/json",
  },
});

/**
 * Maps provider HTTP errors to internal AI errors.
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
 * Validates Groq response.
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
 * Supported models.
 */
function supports(model) {
  return model === MODELS.GPT_OSS_120B;
}

/**
 * Provider availability.
 */
function isAvailable() {
  return Boolean(providerConfig.apiKey);
}

/**
 * Generate completion.
 */
async function generate({
  model,
  messages,
  temperature = config.temperature,
  maxTokens = config.maxOutputTokens,
}) {
  const startedAt = Date.now();

  if (!supports(model)) {
    return {
      success: false,
      provider: PROVIDERS.GROQ,
      error: {
        code: AI_ERRORS.MODEL_NOT_FOUND,
        message: `Groq does not support model "${model}".`,
      },
    };
  }

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

        provider: PROVIDERS.GROQ,

        error: {
          code: AI_ERRORS.INVALID_RESPONSE,

          message: "Groq returned an invalid response.",
        },
      };
    }

    const usage = response.data.usage || {};

    return {
      success: true,

      provider: PROVIDERS.GROQ,

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

      provider: PROVIDERS.GROQ,

      latency: Date.now() - startedAt,

      error: {
        code: mapErrorCode(status),

        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Unknown Groq error.",
      },
    };
  }
}

export { generate, supports, isAvailable };
