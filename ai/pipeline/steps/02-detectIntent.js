import detectIntent from "../../agent/intentDetector/index.js";
import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 02
 * Detect Intent
 * --------------------------------------------------------
 */

export default async function detectIntentStep(state) {
  const intent = await detectIntent(state.query);

  logger.info({
    message: "Intent detected.",
    intent: intent.type,
  });

  return {
    ...state,

    intent,
  };
}
