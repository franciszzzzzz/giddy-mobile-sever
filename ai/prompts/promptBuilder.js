import buildSystemPrompt from "./templates/systemPrompt.js";
import buildRecommendationPrompt from "./templates/recommendationPrompt.js";
import buildEducationPrompt from "./templates/educationPrompt.js";

import { INTENTS } from "../constants/intents.js";

/**
 * Intents whose answers must be grounded in retrieved catalogue products.
 *
 * When one of these yields zero products, the model gets an explicit
 * "nothing was retrieved" instruction so it cannot fabricate a product.
 * Greetings / education / store-info / follow-ups legitimately answer
 * without catalogue context, so they are excluded.
 */
const PRODUCT_INTENTS = new Set([
  INTENTS.PRODUCT_SEARCH,
  INTENTS.PRODUCT_INFORMATION,
  INTENTS.PRODUCT_RECOMMENDATION,
  INTENTS.PRODUCT_COMPARISON,
  INTENTS.CATEGORY,
  INTENTS.SIMILAR_PRODUCTS,
  INTENTS.FEATURED_PRODUCTS,
  INTENTS.PRODUCT_OF_THE_WEEK,
  INTENTS.BRANDS,
  INTENTS.CATEGORIES,
]);

function isProductIntent(intent) {
  return PRODUCT_INTENTS.has(intent?.type);
}

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
   * Compress Retrieved Products
   * ---------------------------------------------------
   */

  const promptProducts = (context.products || [])
    .sort((a, b) => {
      if (a.inStock === b.inStock) return 0;
      return a.inStock ? -1 : 1;
    })
    .slice(0, 10)
    .map((product) => ({
      name: product.name,
      brand: product.brand,
      categories: product.categories,
      price: product.price,
      stock: product.inStock ? "In Stock" : "Out of Stock",
      permalink: product.permalink,
    }));

  /**
   * ---------------------------------------------------
   * Retrieved Context
   * ---------------------------------------------------
   */

  if (promptProducts.length > 0) {
    messages.push({
      role: "system",
      content: `
The following products were retrieved directly from the official Giddy & Claire catalogue.

This catalogue is the source of truth.

Detected Intent:
${intent.type}

Detected Brand:
${intent.brand?.name || "None"}

Detected Gender:
${intent.gender || "None"}

Detected Occasion:
${intent.occasion || "None"}

Detected Fragrance Note:
${intent.note || "None"}

Instructions:

- Use ONLY these retrieved products.
- Never invent products.
- Never invent prices.
- Never invent stock status.
- Filter the list according to what the user asked.
- If no products match, politely explain that nothing matching was found.

Retrieved Products:

${JSON.stringify(promptProducts, null, 2)}
`,
    });
  } else if (isProductIntent(intent)) {
    // Zero retrieved products. Without this block the model has no catalogue
    // grounding at all and will happily fabricate a specific product from
    // conversation history — seen in production where the text named a
    // "Stellar perfume" that never existed in the (empty) product context,
    // so the product card showed nothing while the reply advertised it.
    messages.push({
      role: "system",
      content: `
No products were retrieved from the Giddy & Claire catalogue for this request.

Instructions:

- Do NOT name, recommend, or describe any specific product.
- Do NOT use products remembered from earlier in the conversation — they are no longer available in the current context.
- Politely explain that nothing matching was found right now.
- Offer a helpful next step, e.g. asking a clarifying question (budget, scent preference, who it is for) or suggesting the user browse the featured collection or brands.
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
