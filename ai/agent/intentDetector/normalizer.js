export default function normalizeIntent(intent, entities, query) {
  console.log("normalizeIntent received:", intent);

  return {
    type: intent,
    confidence: 1,
    query,
    ...entities,
  };
}
