import memoryStore from "./memoryStore.js";

function createEmptyMemory() {
  return {
    // Intent
    lastIntent: null,

    // Entities
    lastBrand: null,
    lastCategory: null,
    lastProductType: null,
    lastGender: null,
    lastOccasion: null,
    lastNote: null,

    // Product memory
    lastProducts: [],
    lastProduct: null,
    lastComparison: [],

    // Conversation
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
  // -------------------------
  // Intent
  // -------------------------
  //

  memory.lastIntent = intent?.type || memory.lastIntent;

  //
  // -------------------------
  // Entities
  // -------------------------
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
  // -------------------------
  // Retrieved Products
  // -------------------------
  //

  if (context?.products?.length) {
    memory.lastProducts = context.products;

    // Remember the first product by default.
    // Later we'll update this when the user says
    // "tell me about the third one".
    memory.lastProduct = context.products[0];
  }

  //
  // -------------------------
  // Comparison Memory
  // -------------------------
  //

  if (context?.products?.length >= 2 && intent?.type === "PRODUCT_COMPARISON") {
    memory.lastComparison = context.products;
  }

  //
  // -------------------------
  // Conversation History
  // -------------------------
  //

  memory.history.push({
    user: userMessage,
    assistant: assistantMessage,
    timestamp: Date.now(),
  });

  // Keep only the most recent 10 exchanges.
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
