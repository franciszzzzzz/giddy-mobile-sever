import memoryStore from "./memoryStore.js";

function createEmptyMemory() {
  return {
    lastIntent: null,

    lastBrand: null,
    lastExcludeBrand: null,
    lastCategory: null,
    lastCategoryGroup: null,

    lastProductType: null,
    lastGender: null,
    lastOccasion: null,
    lastRecipient: null,
    lastNote: null,

    lastBudget: null,
    lastMinPrice: null,
    lastMaxPrice: null,

    lastProducts: [],
    lastProduct: null,
    lastComparison: [],

    history: [],
  };
}

export function getConversation(sessionId) {
  return memoryStore.get(sessionId) || createEmptyMemory();
}

export default {
  getConversation,
};
