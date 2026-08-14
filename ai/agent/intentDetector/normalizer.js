export default function normalizeIntent(intent, entities, query) {
  return {
    type: intent,

    confidence: 1,

    query: query.trim(),

    brand: entities.brand,

    excludeBrand: entities.excludeBrand,

    product: entities.product || null,

    comparisonProducts: entities.comparisonProducts || [],

    gender: entities.gender,

    occasion: entities.occasion,

    note: entities.note,

    productType: entities.productType,

    recipient: entities.recipient || null,

    budget: entities.budget || null,

    minPrice: entities.minPrice || null,

    maxPrice: entities.maxPrice || null,

    // "best seller" style queries: fires the featured-products retrieval
    // (the ranker then boosts high sellers via total_sales).
    featured: entities.featured || false,
  };
}
