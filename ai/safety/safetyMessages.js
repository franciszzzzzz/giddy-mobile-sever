/**
 * Centralized safety messages for Claire.
 *
 * Every safety component should return one of these
 * instead of hardcoding responses.
 */

export const SAFETY_MESSAGES = {
  OFF_TOPIC: {
    code: "OFF_TOPIC",

    message:
      "I'm Claire, Giddy & Claire's fragrance assistant. I can help you discover perfumes, compare fragrances, recommend scents for different occasions, explain fragrance notes, and answer questions about our products, orders, shipping, and store policies.",
  },

  PROMPT_INJECTION: {
    code: "PROMPT_INJECTION",

    message:
      "I'm here to assist with Giddy & Claire fragrances, products, and store-related questions. Let me know how I can help you find the perfect fragrance.",
  },

  BLOCKED_CONTENT: {
    code: "BLOCKED_CONTENT",

    message:
      "I'm only able to assist with fragrance, perfume, product, and store-related questions.",
  },

  INPUT_TOO_LONG: {
    code: "INPUT_TOO_LONG",

    message:
      "Your message is a little too long. Please shorten it and try again.",
  },

  EMPTY_INPUT: {
    code: "EMPTY_INPUT",

    message:
      "Please enter a message so I can help you find the perfect fragrance.",
  },

  UNKNOWN_ERROR: {
    code: "UNKNOWN_ERROR",

    message:
      "Sorry, something went wrong while processing your request. Please try again.",
  },
};

export default SAFETY_MESSAGES;
