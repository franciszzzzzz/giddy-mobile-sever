import resolveIntentWithMemory from "../../memory/memoryResolver.js";
import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 04
 * Resolve Conversation Memory
 * --------------------------------------------------------
 */

export default async function resolveMemory(state) {
  const resolvedIntent = resolveIntentWithMemory(state.intent, state.memory);

  logger.info({
    message: "Intent resolved using conversation memory.",
  });

  return {
    ...state,

    intent: resolvedIntent,
  };
}
