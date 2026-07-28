import classifyIntent from "./intentClassifier.js";
import extractEntities from "./entityExtractor.js";
import normalizeIntent from "./normalizer.js";

export default async function detectIntent(message) {
  const entities = await extractEntities(message);

  const intent = classifyIntent(message, entities);

  return normalizeIntent(intent, entities, message);
}
