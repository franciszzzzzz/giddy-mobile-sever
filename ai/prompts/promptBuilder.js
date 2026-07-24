import buildSystemPrompt from "./templates/systemPrompt.js";
import buildRecommendationPrompt from "./templates/recommendationPrompt.js";
import buildEducationPrompt from "./templates/educationPrompt.js";

/**
 * Builds the complete prompt sent to the LLM.
 *
 * @param {Object} options
 * @param {string} options.userMessage
 * @param {Object} options.intent
 * @param {Object} options.context
 * @param {Array} options.history
 *
 * @returns {Array}
 */

export default function buildPrompt({
  userMessage,
  intent,
  context = {},
  history = [],
}) {
  const messages = [];

  /**
   * ---------------------------------------------------
   * Base System Prompt
   * ---------------------------------------------------
   */

  messages.push({
    role: "system",
    content: buildSystemPrompt(),
  });

  /**
   * ---------------------------------------------------
   * Intent-Specific Prompt
   * ---------------------------------------------------
   */

  switch (intent?.type) {
    case "PRODUCT_RECOMMENDATION":
      messages.push({
        role: "system",
        content: buildRecommendationPrompt(),
      });
      break;

    case "EDUCATION":
      messages.push({
        role: "system",
        content: buildEducationPrompt(),
      });
      break;

    default:
      break;
  }

  /**
   * ---------------------------------------------------
   * Retrieved Context
   * ---------------------------------------------------
   */

  if (context && Object.keys(context).length > 0) {
    messages.push({
      role: "system",
      content: `
The following information was retrieved from the official Giddy & Claire catalogue.

Use ONLY this information when answering product-related questions.

If the requested product is not present below, politely say you could not find it.

Retrieved Context:

${JSON.stringify(context, null, 2)}
`,
    });
  }

  /**
   * ---------------------------------------------------
   * Conversation History
   * ---------------------------------------------------
   */

  if (Array.isArray(history) && history.length > 0) {
    messages.push(...history);
  }

  /**
   * ---------------------------------------------------
   * Current User Message
   * ---------------------------------------------------
   */

  messages.push({
    role: "user",
    content: userMessage,
  });

  return messages;
}
