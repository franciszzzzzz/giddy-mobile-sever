import classifyIntent from "./intentClassifier.js";
import extractEntities from "./entityExtractor.js";
import normalizeIntent from "./normalizer.js";

export default async function detectIntent(message) {
  const intent = classifyIntent(message);

  console.log("classifyIntent returned:", intent);
  const entities = await extractEntities(message);

  return normalizeIntent(intent, entities, message);
}
