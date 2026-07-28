import loadConversation from "./steps/01-loadConversation.js";
import detectIntent from "./steps/02-detectIntent.js";
import extractEntities from "./steps/03-extractEntities.js";
import resolveMemory from "./steps/04-resolveMemory.js";
import retrieveProducts from "./steps/05-retrieveProducts.js";
import rankProducts from "./steps/06-rankProducts.js";
import selectStrategy from "./steps/07-selectStrategy.js";
import buildResponse from "./steps/08-buildResponse.js";
import saveConversation from "./steps/09-saveConversation.js";

/**
 * Claire AI Pipeline
 *
 * Every step receives the same state object,
 * modifies it, then passes it to the next step.
 */
export default async function runPipeline({ sessionId, message }) {
  let state = {
    sessionId,

    message,

    query: message,

    memory: null,

    intent: null,

    entities: {},

    products: [],

    strategy: null,

    response: null,

    context: {},
  };

  state = await loadConversation(state);

  state = await detectIntent(state);

  state = await extractEntities(state);

  state = await resolveMemory(state);

  state = await retrieveProducts(state);

  state = await rankProducts(state);

  state = await selectStrategy(state);

  state = await buildResponse(state);

  state = await saveConversation(state);

  return state;
}
