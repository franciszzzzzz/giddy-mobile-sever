import { getStrategy } from "../../rag/strategies/index.js";
import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 05
 * Select Strategy
 * --------------------------------------------------------
 */

export default async function selectStrategy(state) {
  const strategy = getStrategy(state.intent?.type);

  logger.info({
    message: "Strategy selected.",
    intent: state.intent?.type,
  });

  return {
    ...state,
    strategy,
  };
}
