import memoryStore from "./memoryStore.js";
import { getConversation } from "./conversationMemory.js";

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

  if (intent?.type) {
    memory.lastIntent = intent.type;
  }

  //
  // --------------------------------------------------
  // Brand
  // --------------------------------------------------
  //

  if (entities?.brand) {
    memory.lastBrand = entities.brand;
  }

  if (entities?.excludeBrand) {
    memory.lastExcludeBrand = entities.excludeBrand;
  }

  //
  // --------------------------------------------------
  // Category
  // --------------------------------------------------
  //

  if (entities?.category) {
    memory.lastCategory = entities.category;
  }

  //
  // --------------------------------------------------
  // Category Group
  // --------------------------------------------------
  //

  if (entities?.categoryGroup) {
    memory.lastCategoryGroup = entities.categoryGroup;
  }

  //
  // --------------------------------------------------
  // Product Type
  // --------------------------------------------------
  //

  if (entities?.productType) {
    memory.lastProductType = entities.productType;
  }

  //
  // --------------------------------------------------
  // Gender
  // --------------------------------------------------
  //

  if (entities?.gender) {
    memory.lastGender = entities.gender;
  }

  //
  // --------------------------------------------------
  // Occasion
  // --------------------------------------------------
  //

  if (entities?.occasion) {
    memory.lastOccasion = entities.occasion;
  }

  //
  // --------------------------------------------------
  // Fragrance Note
  // --------------------------------------------------
  //

  if (entities?.note) {
    memory.lastNote = entities.note;
  }

  //
  // --------------------------------------------------
  // Recipient
  // --------------------------------------------------
  //

  if (entities?.recipient) {
    memory.lastRecipient = entities.recipient;
  }

  //
  // --------------------------------------------------
  // Budget
  // --------------------------------------------------
  //

  if (entities?.budget != null) {
    memory.lastBudget = entities.budget;
  }

  if (entities?.minPrice != null) {
    memory.lastMinPrice = entities.minPrice;
  }

  if (entities?.maxPrice != null) {
    memory.lastMaxPrice = entities.maxPrice;
  }

  //
  // --------------------------------------------------
  // Retrieved Products
  // --------------------------------------------------
  //

  if (context?.products?.length) {
    memory.lastProducts = context.products;

    // Remember the first product shown
    memory.lastProduct = context.products[0];
  }

  //
  // --------------------------------------------------
  // Explicit Product Selection
  // --------------------------------------------------
  //

  if (intent?.product) {
    memory.lastProduct = intent.product;
  }

  //
  // --------------------------------------------------
  // Product Comparison
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

  if (userMessage || assistantMessage) {
    memory.history.push({
      user: userMessage,
      assistant: assistantMessage,
      timestamp: Date.now(),
    });

    if (memory.history.length > 15) {
      memory.history.shift();
    }
  }

  memoryStore.set(sessionId, memory);

  return memory;
}

export default {
  updateConversation,
};
