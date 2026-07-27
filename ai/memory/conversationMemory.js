import memoryStore from "./memoryStore.js";

function createEmptyMemory() {
  return {
    //
    // Intent
    //
    lastIntent: null,

    //
    // Entities
    //
    lastBrand: null,
    lastCategory: null,
    lastProductType: null,
    lastGender: null,
    lastOccasion: null,
    lastNote: null,

    //
    // Product Memory
    //
    lastProducts: [],
    lastProduct: null,
    lastComparison: [],

    //
    // Conversation
    //
    history: [],
  };
}

export function getConversation(sessionId) {
  return memoryStore.get(sessionId) || createEmptyMemory();
}

export function updateConversation(
  sessionId,
  { intent, entities, context, userMessage, assistantMessage },
) {
  const memory = getConversation(sessionId);

  //
  // --------------------------------------------------
  // Intent
  // --------------------------------------------------
  //

  memory.lastIntent = intent?.type || memory.lastIntent;

  //
  // --------------------------------------------------
  // Entities
  // --------------------------------------------------
  //

  if (entities?.brand) {
    memory.lastBrand = entities.brand;
  }

  if (entities?.gender) {
    memory.lastGender = entities.gender;
  }

  if (entities?.productType) {
    memory.lastProductType = entities.productType;
  }

  if (entities?.occasion) {
    memory.lastOccasion = entities.occasion;
  }

  if (entities?.note) {
    memory.lastNote = entities.note;
  }

  //
  // --------------------------------------------------
  // Retrieved Products
  // --------------------------------------------------
  //

  if (context?.products?.length) {
    memory.lastProducts = context.products;

    // Don't overwrite an already selected product.
    if (!memory.lastProduct) {
      memory.lastProduct = context.products[0];
    }
  }

  //
  // If a follow-up resolved to a specific product
  // ("the second one", "the cheapest", etc.)
  // remember that product.
  //
  if (intent?.product) {
    memory.lastProduct = intent.product;
  }

  //
  // --------------------------------------------------
  // Comparison Memory
  // --------------------------------------------------
  //

  if (intent?.type === "PRODUCT_COMPARISON" && context?.products?.length >= 2) {
    memory.lastComparison = context.products;
  }

  //
  // --------------------------------------------------
  // Conversation History
  // --------------------------------------------------
  //

  memory.history.push({
    user: userMessage,
    assistant: assistantMessage,
    timestamp: Date.now(),
  });

  // Keep only the latest 10 exchanges.
  if (memory.history.length > 10) {
    memory.history.shift();
  }

  memoryStore.set(sessionId, memory);

  return memory;
}

export default {
  getConversation,
  updateConversation,
};
