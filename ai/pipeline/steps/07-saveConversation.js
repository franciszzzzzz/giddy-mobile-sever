import { updateConversation } from "../../memory/updateConversation.js";
import logger from "../../../utils/logger.js";

/**
 * --------------------------------------------------------
 * Step 07
 * Save Conversation
 * --------------------------------------------------------
 *
 * Stores the updated conversation memory after
 * the response has been generated.
 */

export default async function saveConversation(state) {
  updateConversation(state.sessionId, {
    intent: state.intent,

    entities: state.intent,

    context: state.context,

    userMessage: state.message,

    assistantMessage: state.response?.message || "",
  });

  logger.info({
    message: "Conversation saved.",

    sessionId: state.sessionId,
  });

  return state;
}
