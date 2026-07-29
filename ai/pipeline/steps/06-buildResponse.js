import buildPrompt from "../../prompts/promptBuilder.js";
import ClaireAgent from "../../agent/ClaireAgent.js";
import buildResponse from "../../agent/responseBuilder.js";

import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 06
 * Execute Strategy + Generate AI Response
 * --------------------------------------------------------
 *
 * Responsibilities
 *
 * 1. Execute selected strategy
 * 2. Build prompt
 * 3. Ask Claire (LLM)
 * 4. Build API response
 */

export default async function buildResponseStep(state) {
  //
  // --------------------------------------------------
  // Execute Strategy
  // --------------------------------------------------
  //

  const context = state.strategy
    ? await state.strategy.execute(state.intent)
    : {
        source: "none",

        products: [],

        product: null,

        brands: [],

        categories: [],
      };

  //
  // --------------------------------------------------
  // Build Prompt
  // --------------------------------------------------
  //

  const messages = buildPrompt({
    userMessage: state.message,

    intent: state.intent,

    context,

    history: state.memory?.history || [],
  });

  //
  // --------------------------------------------------
  // Ask Claire
  // --------------------------------------------------
  //

  const ai = await ClaireAgent.chat(messages);

  if (!ai.success) {
    return {
      ...state,

      context,

      response: {
        success: false,

        error: ai.error,
      },
    };
  }

  //
  // --------------------------------------------------
  // Build API Response
  // --------------------------------------------------
  //

  const response = buildResponse({
    intent: state.intent,

    context,

    ai,
  });

  logger.info({
    message: "AI response generated.",

    intent: state.intent.type,

    products: context.products?.length || 0,
  });

  return {
    ...state,

    context,

    response,
  };
}
