import { getConversation } from "../../memory/conversationMemory.js";
import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 01
 * Load Conversation Memory
 * --------------------------------------------------------
 *
 * Loads the user's previous conversation from memory.
 *
 * Nothing else happens here.
 */

export default async function loadConversation(state) {
  const memory = getConversation(state.sessionId);

  logger.info({
    message: "Conversation loaded.",
    sessionId: state.sessionId,
  });

  return {
    ...state,

    memory,
  };
}
