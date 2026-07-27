import axios from "axios";

import config from "../config.js";
import { PROVIDER_CONFIG } from "./providerConfig.js";
import { PROVIDERS, MODELS } from "../../constants/models.js";
import { AI_ERRORS } from "../../constants/errors.js";

const providerConfig = PROVIDER_CONFIG[PROVIDERS.GEMINI];

/**
 * Gemini Axios Client
 */
const client = axios.create({
  baseURL: providerConfig.baseURL,

  timeout: config.timeout,
});

/**
 * Maps provider HTTP errors.
 */
function mapErrorCode(status) {
  switch (status) {
    case 400:
      return AI_ERRORS.INVALID_REQUEST;

    case 401:
      return AI_ERRORS.UNAUTHORIZED;

    case 403:
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
 * Supported models.
 */
function supports(model) {
  return model === MODELS.GEMINI_FLASH;
}

/**
 * Provider availability.
 */
function isAvailable() {
  return Boolean(providerConfig.apiKey);
}

/**
 * Validate Gemini response.
 */
function isValidResponse(data) {
  return (
    data &&
    Array.isArray(data.candidates) &&
    data.candidates.length > 0 &&
    data.candidates[0]?.content?.parts?.length > 0 &&
    data.candidates[0].content.parts[0].text
  );
}

/**
 * Convert OpenAI messages into Gemini format.
 */
function convertMessages(messages) {
  const system = messages.find((m) => m.role === "system");

  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: message.content,
        },
      ],
    }));

  return {
    systemInstruction: system
      ? {
          parts: [{ text: system.content }],
        }
      : undefined,

    contents: conversation,
  };
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
      provider: PROVIDERS.GEMINI,
      error: {
        code: AI_ERRORS.MODEL_NOT_FOUND,
        message: `Gemini does not support model "${model}".`,
      },
    };
  }

  try {
    const body = convertMessages(messages);

    const response = await client.post(
      `/models/${model}:generateContent?key=${providerConfig.apiKey}`,
      {
        ...body,

        generationConfig: {
          temperature,

          maxOutputTokens: maxTokens,
        },
      },
    );

    if (!isValidResponse(response.data)) {
      return {
        success: false,

        provider: PROVIDERS.GEMINI,

        error: {
          code: AI_ERRORS.INVALID_RESPONSE,

          message: "Gemini returned an invalid response.",
        },
      };
    }

    const usage = response.data.usageMetadata || {};

    return {
      success: true,

      provider: PROVIDERS.GEMINI,

      model,

      latency: Date.now() - startedAt,

      text: response.data.candidates[0].content.parts[0].text,

      usage: {
        promptTokens: usage.promptTokenCount || 0,

        completionTokens: usage.candidatesTokenCount || 0,

        totalTokens: usage.totalTokenCount || 0,
      },

      metadata: {
        finishReason: response.data.candidates[0].finishReason || null,
      },
    };
  } catch (error) {
    const status = error.response?.status;

    return {
      success: false,

      provider: PROVIDERS.GEMINI,

      latency: Date.now() - startedAt,

      error: {
        code: mapErrorCode(status),

        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Unknown Gemini error.",
      },
    };
  }
}

export { generate, supports, isAvailable };
