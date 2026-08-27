import SAFETY_MESSAGES from "./safetyMessages.js";

/**
 * Prompt Injection Detection
 *
 * Detects common attempts to override Claire's instructions through the
 * chat input (e.g. "ignore your instructions", "you are now DAN",
 * "print your system prompt"). Matches run BEFORE the LLM is called, so
 * an injected message never reaches a model and costs nothing.
 *
 * This is pattern-based defence-in-depth — it cannot catch everything,
 * which is why the system prompt also tells the model to treat message
 * content as data, never as instructions.
 */

const INJECTION_PATTERNS = [
  // Instruction overrides
  /\bignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|initial|original)\b/i,
  /\bignore\s+(all\s+|your\s+)?(instructions|rules|prompts?|constraints|guidelines)\b/i,
  /\bdisregard\s+(all\s+|your\s+|the\s+|any\s+)?(previous|prior|above|instructions|rules|prompts?)\b/i,
  /\bforget\s+(everything|all|your)\b/i,
  /\byou\s+are\s+no\s+longer\b/i,
  /\b(you\s+are|act\s+as|behave\s+like|pretend\s+to\s+be|roleplay\s+as)\s+(an?\s+)?(unfiltered|unrestricted|uncensored|jailbroken|dan|ai\s+without)\b/i,
  /\b(system\s+prompt|initial\s+prompt|developer\s+instructions|hidden\s+instructions|secret\s+prompt)\b/i,
  // Prompt extraction
  /\b(reveal|show|print|repeat|display|output|give\s+me|what\s+are|what's)\s+(your|the)\s+(system\s+)?(prompt|instructions|rules|configuration)\b/i,
  /\brepeat\s+(everything|the\s+text)\s+above\b/i,
  // Mode switching / jailbreaks
  /\b(jailbreak|developer\s+mode|god\s+mode|dan\s+mode|do\s+anything\s+now)\b/i,
  /\b(bypass|disable|turn\s+off|remove)\s+(your|the|all)\s+(restrictions|filters|rules|guardrails|safety)\b/i,
  /\bno\s+(restrictions|filters|rules|guardrails|limits)\b/i,
  // Tool/system impersonation
  /\b(as\s+an?\s+(ai|assistant|language\s+model)|i\s+have\s+no\s+restrictions)\b/i,
  /<\/?(system|assistant|developer)>/i,
];

/**
 * Scans a chat message for prompt-injection attempts.
 *
 * @param {string} message
 * @returns {{ detected: boolean, pattern: string | null, message?: string, code?: string }}
 */
export function detectPromptInjection(message) {
  if (typeof message !== "string") {
    return { detected: false, pattern: null };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        detected: true,
        pattern: pattern.source,
        ...SAFETY_MESSAGES.PROMPT_INJECTION,
      };
    }
  }

  return { detected: false, pattern: null };
}

export default {
  detectPromptInjection,
};
