import { MAX_INPUT_LENGTH } from "../constants/limits.js";
import { checkAllowedTopic } from "./allowedTopics.js";
import { detectPromptInjection } from "./promptInjection.js";
import SAFETY_MESSAGES from "./safetyMessages.js";

/**
 * Chat Input Filter
 *
 * Single gate that every Claire chat message passes through BEFORE any
 * pipeline work or LLM call. Rejected messages get a canned deflection
 * response, so they cost no tokens and never reach a model.
 *
 * Checks, in order (cheapest first):
 *   1. Type / emptiness
 *   2. Length limit (bounds token spend on abusive inputs)
 *   3. Prompt-injection patterns
 *   4. Blocked off-store topics
 *
 * Messages that pass are allowed through even when they contain no
 * fragrance keyword ("uncertain") — those are handled downstream by the
 * UNKNOWN intent and the system prompt's off-topic rules.
 *
 * @param {string} message
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
export function validateChatInput(message) {
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, ...SAFETY_MESSAGES.EMPTY_INPUT };
  }

  if (message.length > MAX_INPUT_LENGTH) {
    return { ok: false, ...SAFETY_MESSAGES.INPUT_TOO_LONG };
  }

  const injection = detectPromptInjection(message);
  if (injection.detected) {
    return { ok: false, code: injection.code, message: injection.message };
  }

  const topic = checkAllowedTopic(message);
  if (!topic.allowed) {
    return { ok: false, code: topic.code, message: topic.message };
  }

  return { ok: true };
}

export default {
  validateChatInput,
};
