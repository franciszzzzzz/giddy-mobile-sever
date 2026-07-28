import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 03
 * Extract Entities
 * --------------------------------------------------------
 *
 * Currently entities come directly
 * from the detected intent.
 */

export default async function extractEntities(state) {
  const entities = {
    ...state.intent,
  };

  logger.info({
    message: "Entities extracted.",
  });

  return {
    ...state,

    entities,
  };
}
