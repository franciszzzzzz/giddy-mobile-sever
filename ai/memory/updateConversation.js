import { getConversation } from "./conversationMemory.js";
import memoryStore from "./memoryStore.js";

export function updateConversation(
  sessionId,
  { intent, entities, context, userMessage, assistantMessage },
) {
  const memory = getConversation(sessionId);

  //
  // -----------------------------
  // Intent
  // -----------------------------
  //

  if (intent?.type) {
    memory.lastIntent = intent.type;
  }

  //
  // -----------------------------
  // Brand
  // -----------------------------
  //

  if (entities?.brand) {
    memory.lastBrand = entities.brand;
  }

  if (entities?.excludeBrand) {
    memory.lastExcludeBrand = entities.excludeBrand;
  }

  //
  // -----------------------------
  // Category
  // -----------------------------
  //

  if (entities?.categoryGroup) {
    memory.lastCategory = entities.categoryGroup;
  }

  //
  // -----------------------------
  // Product Type
  // -----------------------------
  //

  if (entities?.productType) {
    memory.lastProductType = entities.productType;
  }

  //
  // -----------------------------
  // Gender
  // -----------------------------
  //

  if (entities?.gender) {
    memory.lastGender = entities.gender;
  }

  //
  // -----------------------------
  // Occasion
  // -----------------------------
  //

  if (entities?.occasion) {
    memory.lastOccasion = entities.occasion;
  }

  //
  // -----------------------------
  // Note
  // -----------------------------
  //

  if (entities?.note) {
    memory.lastNote = entities.note;
  }

  //
  // -----------------------------
  // Recipient
  // -----------------------------
  //

  if (entities?.recipient) {
    memory.lastRecipient = entities.recipient;
  }

  //
  // -----------------------------
  // Budget
  // -----------------------------
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
  // -----------------------------
  // Retrieved Products
  // -----------------------------
  //

  if (context?.products?.length) {
    memory.lastProducts = context.products;
    memory.lastProduct = context.products[0];
  }

  if (intent?.product) {
    memory.lastProduct = intent.product;
  }

  //
  // -----------------------------
  // Comparison
  // -----------------------------
  //

  if (intent?.type === "PRODUCT_COMPARISON" && context?.products?.length >= 2) {
    memory.lastComparison = context.products;
  }

  //
  // -----------------------------
  // Conversation History
  // -----------------------------
  //

  if (userMessage) {
    memory.history.push({
      role: "user",
      content: userMessage,
    });
  }

  if (assistantMessage) {
    memory.history.push({
      role: "assistant",
      content: assistantMessage,
    });
  }

  //
  // Keep last 20 messages
  //

  if (memory.history.length > 20) {
    memory.history = memory.history.slice(-20);
  }

  memoryStore.set(sessionId, memory);

  return memory;
}

export default {
  updateConversation,
};
