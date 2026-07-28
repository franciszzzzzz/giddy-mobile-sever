import retrievalService from "../retrieval.service.js";

/**
 * Product Search Strategy
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
