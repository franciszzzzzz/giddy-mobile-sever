import retrievalService from "../retrieval.service.js";

/**
 * Recommendation Strategy
 *
 * Delegates product retrieval entirely
 * to the RAG retrieval service.
 */
async function execute(intent) {
  return retrievalService.retrieve(intent);
}

export default {
  execute,
};
