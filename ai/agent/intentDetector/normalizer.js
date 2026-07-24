export default function normalizeIntent(intent, entities) {
  return {
    type: intent,

    confidence: 1,

    ...entities,
  };
}
