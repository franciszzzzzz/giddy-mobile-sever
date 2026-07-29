import { retrieve } from "../retrieval.service.js";

/**
 * Recommendation Strategy
 *
 * Delegates product retrieval entirely
 * to the RAG retrieval service.
 */
async function execute(intent) {
  return retrieve(intent);
}

export default {
  execute,
};
